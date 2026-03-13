from fastapi import APIRouter, Depends
from datetime import datetime, timezone
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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cache_key = f"dashboard:analytics:{current_user.id}"
    cached = await cache_get_json(cache_key)
    if cached:
        return cached

    rows = (
        await db.execute(
            select(
                Quiz.id,
                Quiz.title,
                func.count(Result.id).label("attempts"),
                func.avg(Result.final_score).label("average_score"),
                func.max(Result.final_score).label("highest_score"),
                func.min(Result.final_score).label("lowest_score"),
                func.avg(case((Result.status == "GRADED", 1), else_=0)).label("completion_rate"),
                func.sum(Result.violation_count).label("violations"),
            )
            .select_from(Quiz)
            .outerjoin(Attempt, Attempt.quiz_id == Quiz.id)
            .outerjoin(Result, Result.attempt_id == Attempt.id)
            .where(Quiz.created_by == current_user.id, Quiz.is_archived.is_(False))
            .group_by(Quiz.id, Quiz.title)
            .order_by(Quiz.updated_at.desc())
        )
    ).all()

    total_attempts = sum(int(row.attempts or 0) for row in rows)
    total_violations = sum(int(row.violations or 0) for row in rows)
    average_score = round(sum(float(row.average_score or 0) for row in rows) / max(1, len(rows)), 1)
    completion_rate = round(sum(float(row.completion_rate or 0) for row in rows) / max(1, len(rows)) * 100, 1)
    highest_score = max((int(row.highest_score or 0) for row in rows), default=0)
    lowest_score = min((int(row.lowest_score or 0) for row in rows if row.lowest_score is not None), default=0)

    payload = {
        "metrics": {
            "total_attempts": total_attempts,
            "completion_rate": completion_rate,
            "average_score": average_score,
            "total_violations": total_violations,
            "highest_score": highest_score,
            "lowest_score": lowest_score,
        },
        "score_distribution": [
            {
                "quiz_name": row.title,
                "average_score": round(float(row.average_score or 0), 1),
                "highest_score": int(row.highest_score or 0),
                "lowest_score": int(row.lowest_score or 0),
            }
            for row in rows
        ],
        "table": [
            {
                "quiz_id": str(row.id),
                "quiz_name": row.title,
                "attempts": int(row.attempts or 0),
                "average_score": round(float(row.average_score or 0), 1),
                "completion_rate": round(float(row.completion_rate or 0) * 100, 1),
                "violations": int(row.violations or 0),
            }
            for row in rows
        ],
    }
    await cache_set_json(cache_key, payload, ttl_seconds=45)
    return payload
