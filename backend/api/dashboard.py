from collections import defaultdict
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user
from backend.core.database import get_db
from backend.core.redis import cache_get_json, cache_set_json
from backend.models.answer import Answer
from backend.models.ai_job import AIJob
from backend.models.attempt import Attempt
from backend.models.question import Question
from backend.models.quiz import Quiz
from backend.models.result import Result
from backend.models.student_profile import StudentProfile
from backend.models.user import User

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_date_param(value: str | None, *, end_of_day: bool = False) -> datetime | None:
    if not value:
        return None
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    else:
        parsed = parsed.astimezone(timezone.utc)
    if end_of_day:
        return parsed.replace(hour=23, minute=59, second=59, microsecond=999999)
    return parsed.replace(hour=0, minute=0, second=0, microsecond=0)


def _normalize_quiz_title(title: str | None) -> str:
    return " ".join((title or "Untitled Quiz").split()).casefold()


def _display_quiz_title(title: str | None) -> str:
    compact = " ".join((title or "Untitled Quiz").split())
    if not compact:
        return "Untitled Quiz"
    if compact.islower() or compact.isupper():
        return compact.title()
    return compact


def _to_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _matches_status_filter(row, status_filter: str) -> bool:
    if status_filter == "completed":
        return str(row.result_status or "").upper() == "GRADED"
    if status_filter == "flagged":
        return int(row.violation_count or 0) > 0
    if status_filter == "in_progress":
        return str(row.result_status or "").upper() != "GRADED"
    return True


def _format_day_label(day_key: str) -> str:
    return datetime.fromisoformat(day_key).strftime("%b %d")


def _build_metric_snapshot(rows: list, group_rows: list[dict]) -> dict:
    attempts = len(rows)
    completed_rows = [row for row in rows if str(row.result_status or "").upper() == "GRADED"]
    scores = [float(row.final_score or 0) for row in completed_rows]
    total_violations = sum(int(row.violation_count or 0) for row in rows)

    return {
        "total_attempts": attempts,
        "completion_rate": round((len(completed_rows) / attempts) * 100, 1) if attempts else 0,
        "average_score": round(sum(scores) / len(scores), 1) if scores else 0,
        "total_violations": total_violations,
        "highest_score": round(max(scores), 1) if scores else 0,
        "lowest_score": round(min(scores), 1) if scores else 0,
        "active_quizzes": len(group_rows),
    }


def _build_metric_deltas(current: dict, previous: dict, context_label: str) -> dict:
    deltas: dict[str, dict] = {}
    for key in ["total_attempts", "completion_rate", "average_score", "total_violations"]:
        current_value = float(current.get(key, 0) or 0)
        previous_value = float(previous.get(key, 0) or 0)
        delta = round(current_value - previous_value, 1)
        if previous_value == 0:
            delta_percent = 0 if current_value == 0 else 100
        else:
            delta_percent = round((delta / previous_value) * 100, 1)
        deltas[key] = {
            "delta": delta,
            "delta_percent": delta_percent,
            "direction": "up" if delta > 0 else "down" if delta < 0 else "flat",
            "context": context_label,
        }
    return deltas


def _build_grouped_rows(rows: list) -> list[dict]:
    groups: dict[str, dict] = {}
    for row in rows:
        normalized_title = _normalize_quiz_title(row.quiz_title)
        group = groups.get(normalized_title)
        updated_at = _to_utc(row.quiz_updated_at) or datetime.min.replace(tzinfo=timezone.utc)
        if group is None:
            group = {
                "quiz_id": str(row.quiz_id),
                "quiz_name": _display_quiz_title(row.quiz_title),
                "latest_updated_at": updated_at,
                "attempts": 0,
                "completed": 0,
                "scores": [],
                "violations": 0,
            }
            groups[normalized_title] = group
        elif updated_at > group["latest_updated_at"]:
            group["quiz_id"] = str(row.quiz_id)
            group["quiz_name"] = _display_quiz_title(row.quiz_title)
            group["latest_updated_at"] = updated_at

        group["attempts"] += 1
        if str(row.result_status or "").upper() == "GRADED":
            group["completed"] += 1
            group["scores"].append(float(row.final_score or 0))
        group["violations"] += int(row.violation_count or 0)

    grouped_rows: list[dict] = []
    for group in groups.values():
        scores = group["scores"]
        grouped_rows.append(
            {
                "quiz_id": group["quiz_id"],
                "quiz_name": group["quiz_name"],
                "attempts": group["attempts"],
                "average_score": round(sum(scores) / len(scores), 1) if scores else 0,
                "completion_rate": round((group["completed"] / group["attempts"]) * 100, 1) if group["attempts"] else 0,
                "violations": group["violations"],
            }
        )

    return sorted(grouped_rows, key=lambda item: (-item["attempts"], item["quiz_name"]))


def _build_completion_trend(rows: list) -> list[dict]:
    by_day: dict[str, dict[str, float]] = defaultdict(lambda: {"attempts": 0, "completed": 0, "score_total": 0, "score_count": 0})
    for row in rows:
        attempt_created_at = _to_utc(row.attempt_created_at)
        if attempt_created_at is None:
            continue
        day_key = attempt_created_at.date().isoformat()
        by_day[day_key]["attempts"] += 1
        if str(row.result_status or "").upper() == "GRADED":
            by_day[day_key]["completed"] += 1
            by_day[day_key]["score_total"] += float(row.final_score or 0)
            by_day[day_key]["score_count"] += 1

    trend: list[dict] = []
    for day_key in sorted(by_day.keys()):
        attempts = int(by_day[day_key]["attempts"])
        completed = int(by_day[day_key]["completed"])
        score_count = int(by_day[day_key]["score_count"])
        trend.append(
            {
                "date": day_key,
                "label": _format_day_label(day_key),
                "attempts": attempts,
                "completion_rate": round((completed / attempts) * 100, 1) if attempts else 0,
                "average_score": round(by_day[day_key]["score_total"] / score_count, 1) if score_count else 0,
            }
        )
    return trend


def _build_score_distribution(grouped_rows: list[dict], rows: list) -> dict:
    scores = [float(row.final_score or 0) for row in rows if str(row.result_status or "").upper() == "GRADED"]
    overall_ranges = [
        ("0-20", 0, 20),
        ("21-40", 21, 40),
        ("41-60", 41, 60),
        ("61-80", 61, 80),
        ("81-100", 81, 100),
        ("100+", 101, None),
    ]
    overall = []
    for label, start, end in overall_ranges:
        count = 0
        for score in scores:
            if score < start:
                continue
            if end is not None and score > end:
                continue
            count += 1
        overall.append({"range": label, "students": count})

    by_quiz = [
        {
            "quiz_name": row["quiz_name"],
            "students": row["attempts"],
            "average_score": row["average_score"],
        }
        for row in grouped_rows
    ]
    return {"overall": overall, "by_quiz": by_quiz}


def _build_violation_chart(grouped_rows: list[dict]) -> list[dict]:
    return [
        {
            "quiz_name": row["quiz_name"],
            "violations": row["violations"],
        }
        for row in sorted(grouped_rows, key=lambda item: (-item["violations"], item["quiz_name"]))
    ]


def _build_insights(current_metrics: dict, previous_metrics: dict, grouped_rows: list[dict], trend: list[dict]) -> list[str]:
    insights: list[str] = []
    completion_delta = round(float(current_metrics["completion_rate"]) - float(previous_metrics["completion_rate"]), 1)
    if completion_delta <= -5:
        insights.append(f"Completion rate is dropping by {abs(completion_delta)} points versus the previous period.")

    violation_delta = int(current_metrics["total_violations"] or 0) - int(previous_metrics["total_violations"] or 0)
    if violation_delta > 0:
        insights.append(f"Violations increased by {violation_delta} in the selected period.")

    top_violation = next((row for row in grouped_rows if row["violations"] > 0), None)
    if top_violation:
        insights.append(f"{top_violation['quiz_name']} has the highest integrity risk with {top_violation['violations']} violations.")

    if len(trend) >= 2 and trend[-1]["average_score"] > trend[0]["average_score"] + 5:
        insights.append("Average scores are trending upward across the current period.")

    return insights[:3]


def _build_filter_options(quizzes: list) -> list[dict]:
    deduped: dict[str, dict] = {}
    for quiz in quizzes:
        key = _normalize_quiz_title(quiz.title)
        updated_at = _to_utc(quiz.updated_at) or datetime.min.replace(tzinfo=timezone.utc)
        existing = deduped.get(key)
        if existing is None or updated_at > existing["updated_at"]:
            deduped[key] = {
                "value": key,
                "label": _display_quiz_title(quiz.title),
                "updated_at": updated_at,
            }
    return [
        {"value": item["value"], "label": item["label"]}
        for item in sorted(deduped.values(), key=lambda entry: entry["label"])
    ]


@router.get("/summary")
async def get_dashboard_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cache_key = f"dashboard:summary:{current_user.id}"
    cached = await cache_get_json(cache_key)
    if cached:
        return cached

    stats_row = (
        await db.execute(
            select(
                func.count(Quiz.id),
                func.count(Quiz.id).filter(Quiz.is_published.is_(True)),
            ).where(Quiz.created_by == current_user.id, Quiz.is_archived.is_(False))
        )
    ).one()
    total_quizzes, published_exams = int(stats_row[0] or 0), int(stats_row[1] or 0)

    processing_jobs = int(
        (
            await db.execute(
                select(func.count(AIJob.id))
                .join(Quiz, Quiz.id == AIJob.quiz_id)
                .where(
                    Quiz.created_by == current_user.id,
                    Quiz.is_archived.is_(False),
                    AIJob.job_type == "QUIZ_CREATION",
                    AIJob.status.in_(["PENDING", "PROCESSING"]),
                )
            )
        ).scalar()
        or 0
    )

    active_attempts = int(
        (
            await db.execute(
                select(func.count(func.distinct(Attempt.quiz_id)))
                .join(Quiz, Quiz.id == Attempt.quiz_id)
                .where(Quiz.created_by == current_user.id, Quiz.is_archived.is_(False), Attempt.submitted_at.is_(None))
            )
        ).scalar()
        or 0
    )

    recent_quizzes_result = await db.execute(
        select(
            Quiz.id,
            Quiz.title,
            Quiz.description,
            Quiz.ai_generation_status,
            Quiz.is_published,
            Quiz.is_archived,
            Quiz.duration_minutes,
            Quiz.updated_at,
            func.count(func.distinct(Question.id)).label("question_count"),
        )
        .outerjoin(Question, Question.quiz_id == Quiz.id)
        .where(Quiz.created_by == current_user.id, Quiz.is_archived.is_(False))
        .group_by(
            Quiz.id,
            Quiz.title,
            Quiz.description,
            Quiz.ai_generation_status,
            Quiz.is_published,
            Quiz.is_archived,
            Quiz.duration_minutes,
            Quiz.updated_at,
        )
        .order_by(Quiz.updated_at.desc())
        .limit(8)
    )
    recent_quizzes = [
        {
            "id": str(row.id),
            "title": row.title,
            "description": row.description,
            "ai_generation_status": row.ai_generation_status,
            "is_published": row.is_published,
            "is_archived": row.is_archived,
            "duration_minutes": row.duration_minutes,
            "question_count": int(row.question_count or 0),
            "updated_at": row.updated_at,
        }
        for row in recent_quizzes_result.all()
    ]

    active_exams_result = await db.execute(
        select(
            Quiz.id,
            Quiz.title,
            Quiz.duration_minutes,
            func.count(Attempt.id).label("active_students"),
            func.coalesce(func.sum(Result.violation_count), 0).label("violations_count"),
            func.count(Result.id).label("submissions_count"),
            func.min(Attempt.created_at).label("started_at"),
        )
        .outerjoin(
            Attempt,
            (Attempt.quiz_id == Quiz.id) & (Attempt.submitted_at.is_(None)),
        )
        .outerjoin(Result, Result.attempt_id == Attempt.id)
        .where(
            Quiz.created_by == current_user.id,
            Quiz.is_published.is_(True),
            Quiz.is_archived.is_(False),
        )
        .group_by(Quiz.id, Quiz.title, Quiz.duration_minutes)
        .order_by(func.count(Attempt.id).desc(), Quiz.updated_at.desc())
        .limit(6)
    )
    now = datetime.now(timezone.utc)
    active_exams = []
    for row in active_exams_result.all():
        time_remaining_seconds = None
        if row.started_at:
            elapsed_seconds = max(0, int((now - row.started_at).total_seconds()))
            time_remaining_seconds = max(0, int((row.duration_minutes or 60) * 60) - elapsed_seconds)
        active_exams.append(
            {
                "id": str(row.id),
                "title": row.title,
                "active_students": int(row.active_students or 0),
                "violations_count": int(row.violations_count or 0),
                "submissions_count": int(row.submissions_count or 0),
                "time_remaining_seconds": time_remaining_seconds,
            }
        )

    running_jobs_result = await db.execute(
        select(AIJob.id, AIJob.quiz_id, Quiz.title, AIJob.created_at, AIJob.meta)
        .join(Quiz, Quiz.id == AIJob.quiz_id)
        .where(
            Quiz.created_by == current_user.id,
            Quiz.is_archived.is_(False),
            AIJob.job_type == "QUIZ_CREATION",
            AIJob.status.in_(["PENDING", "PROCESSING"]),
        )
        .order_by(AIJob.created_at.desc())
        .limit(4)
    )
    running_jobs = [
        {
            "id": str(row.id),
            "quiz_id": str(row.quiz_id),
            "quiz_title": row.title,
            "created_at": row.created_at,
            "progress": int((row.meta or {}).get("progress", 0)),
            "stage": str((row.meta or {}).get("stage", "queued")),
            "estimated_seconds": int((row.meta or {}).get("estimated_seconds", 20)),
        }
        for row in running_jobs_result.all()
    ]

    recent_activity = [
        {
            "id": quiz["id"],
            "title": quiz["title"],
            "event": "AI generation running" if str(quiz["ai_generation_status"]).upper() == "PROCESSING" else "Quiz updated",
            "updated_at": quiz["updated_at"],
        }
        for quiz in recent_quizzes[:6]
    ]

    payload = {
        "stats": {
            "total_quizzes": total_quizzes,
            "published_exams": published_exams,
            "ai_jobs_running": processing_jobs,
            "active_exams": active_attempts,
        },
        "recent_quizzes": recent_quizzes,
        "active_exams": active_exams,
        "recent_activity": recent_activity,
        "running_jobs": running_jobs,
    }
    await cache_set_json(cache_key, payload, ttl_seconds=45)
    return payload


@router.get("/live-exams")
async def get_live_exams(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cache_key = f"dashboard:live_exams:{current_user.id}"
    cached = await cache_get_json(cache_key)
    if cached:
        return cached

    active_attempts_result = await db.execute(
        select(
            Attempt.id,
            Attempt.quiz_id,
            Attempt.created_at,
            Attempt.submitted_at,
            Attempt.status,
            Quiz.title.label("quiz_title"),
            Quiz.duration_minutes,
            StudentProfile.student_name,
            Result.violation_count,
            func.count(Answer.id).label("answered_count"),
        )
        .join(Quiz, Quiz.id == Attempt.quiz_id)
        .outerjoin(StudentProfile, StudentProfile.attempt_id == Attempt.id)
        .outerjoin(Result, Result.attempt_id == Attempt.id)
        .outerjoin(Answer, Answer.attempt_id == Attempt.id)
        .where(
            Quiz.created_by == current_user.id,
            Quiz.is_published.is_(True),
            Quiz.is_archived.is_(False),
            Attempt.submitted_at.is_(None),
        )
        .group_by(
            Attempt.id,
            Attempt.quiz_id,
            Attempt.created_at,
            Attempt.submitted_at,
            Attempt.status,
            Quiz.title,
            Quiz.duration_minutes,
            StudentProfile.student_name,
            Result.violation_count,
        )
        .order_by(Quiz.title.asc(), Attempt.created_at.desc())
    )
    rows = active_attempts_result.all()
    now = datetime.now(timezone.utc)
    exam_map: dict[str, dict] = {}
    alerts: list[dict] = []
    # compute in Python to avoid dialect-specific interval composition
    for row in rows:
        started_at = row.created_at
        duration_seconds = int((row.duration_minutes or 60) * 60)
        elapsed = int((now - started_at).total_seconds()) if started_at else 0
        remaining_seconds = max(0, duration_seconds - max(0, elapsed))
        quiz_key = str(row.quiz_id)
        exam = exam_map.setdefault(
            quiz_key,
            {
                "quiz_id": quiz_key,
                "quiz_name": row.quiz_title,
                "active_students": 0,
                "violations_count": 0,
                "submissions_count": 0,
                "time_remaining_seconds": remaining_seconds,
                "students": [],
            },
        )
        exam["active_students"] += 1
        exam["violations_count"] += int(row.violation_count or 0)
        exam["time_remaining_seconds"] = min(exam["time_remaining_seconds"], remaining_seconds)
        student_payload = {
            "attempt_id": str(row.id),
            "student_name": row.student_name or "Unknown Student",
            "current_question": int(row.answered_count or 0) + 1,
            "violations": int(row.violation_count or 0),
            "status": row.status,
            "time_remaining_seconds": remaining_seconds,
        }
        exam["students"].append(student_payload)
        if int(row.violation_count or 0) > 0:
            alerts.append(
                {
                    "quiz_id": quiz_key,
                    "quiz_name": row.quiz_title,
                    "message": f"Violation detected for {student_payload['student_name']}",
                    "severity": "warning" if int(row.violation_count or 0) < 3 else "critical",
                }
            )

    payload = {
        "items": list(exam_map.values()),
        "alerts": alerts[:6],
    }
    await cache_set_json(cache_key, payload, ttl_seconds=10)
    return payload


@router.get("/analytics")
async def get_analytics_overview(
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    quiz: str | None = Query(default=None),
    status: str = Query(default="all"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    end_date = _parse_date_param(date_to, end_of_day=True) or _utc_now().replace(hour=23, minute=59, second=59, microsecond=999999)
    start_date = _parse_date_param(date_from) or (end_date - timedelta(days=29)).replace(hour=0, minute=0, second=0, microsecond=0)
    if start_date > end_date:
        start_date, end_date = end_date.replace(hour=0, minute=0, second=0, microsecond=0), start_date.replace(hour=23, minute=59, second=59, microsecond=999999)

    period_days = max(1, int((end_date.date() - start_date.date()).days) + 1)
    previous_end = start_date - timedelta(microseconds=1)
    previous_start = start_date - timedelta(days=period_days)
    normalized_quiz_filter = _normalize_quiz_title(quiz) if quiz and quiz != "all" else None
    normalized_status = status if status in {"all", "completed", "in_progress", "flagged"} else "all"

    cache_key = f"dashboard:analytics:{current_user.id}:{start_date.date().isoformat()}:{end_date.date().isoformat()}:{normalized_quiz_filter or 'all'}:{normalized_status}"
    cached = await cache_get_json(cache_key)
    if cached:
        return cached

    quiz_rows = (
        await db.execute(
            select(
                Quiz.id,
                Quiz.title,
                Quiz.updated_at,
            )
            .where(Quiz.created_by == current_user.id, Quiz.is_archived.is_(False))
        )
    ).all()

    analytics_rows = (
        await db.execute(
            select(
                Quiz.id.label("quiz_id"),
                Quiz.title.label("quiz_title"),
                Quiz.updated_at.label("quiz_updated_at"),
                Attempt.id.label("attempt_id"),
                Attempt.created_at.label("attempt_created_at"),
                Attempt.status.label("attempt_status"),
                Result.final_score.label("final_score"),
                Result.violation_count.label("violation_count"),
                Result.status.label("result_status"),
            )
            .select_from(Attempt)
            .join(Quiz, Quiz.id == Attempt.quiz_id)
            .outerjoin(Result, Result.attempt_id == Attempt.id)
            .where(
                Quiz.created_by == current_user.id,
                Quiz.is_archived.is_(False),
                Attempt.created_at >= previous_start,
                Attempt.created_at <= end_date,
            )
        )
    ).all()

    def in_current_period(row) -> bool:
        created_at = _to_utc(row.attempt_created_at)
        return created_at is not None and start_date <= created_at <= end_date

    def in_previous_period(row) -> bool:
        created_at = _to_utc(row.attempt_created_at)
        return created_at is not None and previous_start <= created_at <= previous_end

    def passes_filters(row) -> bool:
        if normalized_quiz_filter and _normalize_quiz_title(row.quiz_title) != normalized_quiz_filter:
            return False
        return _matches_status_filter(row, normalized_status)

    current_rows = [row for row in analytics_rows if in_current_period(row) and passes_filters(row)]
    previous_rows = [row for row in analytics_rows if in_previous_period(row) and passes_filters(row)]

    grouped_rows = _build_grouped_rows(current_rows)
    current_metrics = _build_metric_snapshot(current_rows, grouped_rows)
    previous_grouped_rows = _build_grouped_rows(previous_rows)
    previous_metrics = _build_metric_snapshot(previous_rows, previous_grouped_rows)
    completion_trend = _build_completion_trend(current_rows)
    score_distribution = _build_score_distribution(grouped_rows, current_rows)
    violations_by_quiz = _build_violation_chart(grouped_rows)
    filter_options = _build_filter_options(quiz_rows)
    comparison_context = f"vs previous {period_days} day{'s' if period_days != 1 else ''}"

    payload = {
        "filters": {
            "selected": {
                "date_from": start_date.date().isoformat(),
                "date_to": end_date.date().isoformat(),
                "quiz": normalized_quiz_filter or "all",
                "status": normalized_status,
            },
            "quizzes": filter_options,
            "statuses": [
                {"value": "all", "label": "All attempts"},
                {"value": "completed", "label": "Completed"},
                {"value": "in_progress", "label": "In progress"},
                {"value": "flagged", "label": "Flagged"},
            ],
        },
        "metrics": current_metrics,
        "metric_deltas": _build_metric_deltas(current_metrics, previous_metrics, comparison_context),
        "score_distribution": score_distribution,
        "completion_trend": completion_trend,
        "violations_by_quiz": violations_by_quiz,
        "table": grouped_rows,
        "insights": _build_insights(current_metrics, previous_metrics, grouped_rows, completion_trend),
    }
    await cache_set_json(cache_key, payload, ttl_seconds=45)
    return payload
