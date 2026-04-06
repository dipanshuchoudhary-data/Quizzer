import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from backend.core.database import get_db
from backend.models.quiz import Quiz
from backend.models.attempt import Attempt
from backend.models.question import Question
from backend.models.quiz_settings import QuizSettings
from backend.models.student_profile import StudentProfile
from backend.schemas.attempt import (
    ExamEntryConfigResponse,
    StartPublicAttemptRequest,
    StartAttemptRequest,
    StartAttemptResponse,
    SubmitAttemptResponse,
)
from backend.core.redis import (
    get_remaining_time,
    start_exam_timer,
    set_heartbeat,
    lock_attempt_session,
    exam_expired,
)
from backend.ai.graphs.result_processing_graph import build_result_processing_graph
from backend.services.verification import (
    normalize_verification_schema,
    validate_verification_submission,
)


router = APIRouter(prefix="/attempts", tags=["Attempts"])


def _load_legacy_runtime_settings(quiz: Quiz) -> dict:
    raw = quiz.settings_json if isinstance(quiz.settings_json, dict) else {}
    verification = raw.get("verification") if isinstance(raw.get("verification"), dict) else None
    return {
        "require_fullscreen": bool(raw.get("require_fullscreen", True)),
        "violation_limit": max(1, int(raw.get("violation_limit", 3) or 3)),
        "verification": normalize_verification_schema(verification, quiz.academic_type),
    }


async def _load_runtime_settings(db: AsyncSession, quiz: Quiz) -> dict:
    defaults = _load_legacy_runtime_settings(quiz)
    try:
        result = await db.execute(
            select(QuizSettings).where(
                QuizSettings.quiz_id == quiz.id,
                QuizSettings.owner_user_id == quiz.created_by,
            )
        )
        settings_record = result.scalar_one_or_none()
    except SQLAlchemyError:
        return defaults

    if not settings_record:
        return defaults

    return {
        "require_fullscreen": settings_record.require_fullscreen,
        "violation_limit": max(1, int(settings_record.violation_limit or defaults["violation_limit"])),
        "verification": defaults["verification"],
    }


async def _load_attempt_questions(db: AsyncSession, quiz_id: uuid.UUID) -> list[Question]:
    questions_result = await db.execute(
        select(Question)
        .where(Question.quiz_id == quiz_id, Question.status == "APPROVED")
        .order_by(Question.created_at.asc())
    )
    return questions_result.scalars().all()


def _serialize_question_snapshot(questions: list[Question]) -> list[dict]:
    return [
        {
            "id": str(question.id),
            "question_text": question.question_text,
            "question_type": question.question_type,
            "options": question.options,
            "marks": int(question.marks or 1),
            "correct_answer": question.correct_answer,
        }
        for question in questions
    ]


async def _build_attempt_response(db: AsyncSession, attempt: Attempt, quiz: Quiz) -> StartAttemptResponse:
    questions = attempt.questions_snapshot or _serialize_question_snapshot(await _load_attempt_questions(db, quiz.id))
    duration_seconds = max(300, int((getattr(quiz, "duration_minutes", 60) or 60) * 60))
    started_at = getattr(attempt, "created_at", None) or datetime.now(timezone.utc)
    if started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=timezone.utc)
    remaining_time = await get_remaining_time(str(attempt.id))
    effective_remaining = remaining_time if remaining_time and remaining_time > 0 else duration_seconds
    return StartAttemptResponse(
        attempt_id=attempt.id,
        attempt_token=attempt.attempt_token,
        duration_seconds=effective_remaining,
        duration=duration_seconds,
        questions=questions,
        academic_type=quiz.academic_type,
        quiz_title=quiz.title,
        start_time=started_at,
        end_time=started_at + timedelta(seconds=duration_seconds),
    )


async def _grade_attempt(db: AsyncSession, attempt_id: str) -> None:
    graph = build_result_processing_graph()
    await graph.ainvoke(
        {
            "db": db,
            "attempt_id": attempt_id,
            "objective_score": 0,
            "short_answer_payload": [],
            "short_answer_scores": [],
            "violation_count": 0,
            "final_score": 0,
            "review_required": False,
        }
    )


async def _create_attempt(
    *,
    db: AsyncSession,
    quiz: Quiz,
    verification_context: str,
    verification_data: dict,
) -> StartAttemptResponse:
    questions = await _load_attempt_questions(db, quiz.id)
    if not questions:
        raise HTTPException(status_code=410, detail="Exam has ended")

    runtime_settings = await _load_runtime_settings(db, quiz)
    verification = validate_verification_submission(runtime_settings["verification"], verification_data)

    existing_attempt_result = await db.execute(
        select(Attempt).where(
            Attempt.quiz_id == quiz.id,
            Attempt.enrollment_number == verification.identity_key,
        )
    )
    existing_attempt = existing_attempt_result.scalar_one_or_none()
    if existing_attempt:
        if existing_attempt.submitted_at or existing_attempt.status in {"SUBMITTED", "GRADED"}:
            raise HTTPException(status_code=409, detail="You have already started or completed this exam.")
        if await exam_expired(str(existing_attempt.id)):
            existing_attempt.status = "SUBMITTED"
            existing_attempt.submitted_at = datetime.now(timezone.utc)
            await db.commit()
            raise HTTPException(status_code=409, detail="You have already started or completed this exam.")
        return await _build_attempt_response(db, existing_attempt, quiz)

    duration_seconds = max(300, int((getattr(quiz, "duration_minutes", 60) or 60) * 60))
    attempt_token = str(uuid.uuid4())
    started_at = datetime.now(timezone.utc)
    expires_at = started_at + timedelta(seconds=duration_seconds)

    attempt = Attempt(
        quiz_id=quiz.id,
        attempt_token=attempt_token,
        enrollment_number=verification.identity_key,
        status="IN_PROGRESS",
        final_score=0,
        questions_snapshot=_serialize_question_snapshot(questions),
    )

    db.add(attempt)
    await db.flush()

    profile = StudentProfile(
        attempt_id=attempt.id,
        student_name=verification.legacy_profile["student_name"] or verification.display_identifier,
        enrollment_number=verification.legacy_profile["enrollment_number"] or verification.display_identifier,
        institution_type=verification_context,
        verification_context=verification.context,
        verification_data=verification.data,
        course=verification.legacy_profile["course"],
        section=verification.legacy_profile["section"],
        batch=verification.legacy_profile["batch"],
        semester=verification.legacy_profile["semester"],
        class_name=verification.legacy_profile["class_name"],
        class_section=verification.legacy_profile["class_section"],
    )

    db.add(profile)
    await db.commit()
    await db.refresh(attempt)

    locked = await lock_attempt_session(str(attempt.id))
    if not locked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Multiple sessions detected",
        )

    await start_exam_timer(str(attempt.id), duration_seconds)
    return StartAttemptResponse(
        attempt_id=attempt.id,
        attempt_token=attempt_token,
        duration_seconds=duration_seconds,
        duration=duration_seconds,
        questions=questions,
        academic_type=quiz.academic_type,
        quiz_title=quiz.title,
        start_time=started_at,
        end_time=expires_at,
    )


def _validate_attempt_token(attempt: Attempt, provided_token: str | None) -> None:
    if not provided_token or provided_token != attempt.attempt_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid attempt token",
        )


@router.post("/{quiz_id}/start", response_model=StartAttemptResponse)
async def start_attempt(
    quiz_id: uuid.UUID,
    payload: StartAttemptRequest,
    db: AsyncSession = Depends(get_db),
):

    result = await db.execute(select(Quiz).where(Quiz.id == quiz_id))
    quiz = result.scalar_one_or_none()

    if not quiz or not quiz.is_published:
        raise HTTPException(status_code=404, detail="Quiz not available")
    runtime_settings = await _load_runtime_settings(db, quiz)
    verification_schema = runtime_settings["verification"]
    verification_context = verification_schema.get("context") or str(payload.verification_context or quiz.academic_type or "college").lower()

    return await _create_attempt(
        db=db,
        quiz=quiz,
        verification_context=verification_context,
        verification_data=payload.verification_data,
    )


@router.post("/start", response_model=StartAttemptResponse)
async def start_public_attempt(
    payload: StartPublicAttemptRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Quiz).where(Quiz.public_id == payload.public_exam_id))
    quiz = result.scalar_one_or_none()

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    if not quiz.is_published:
        raise HTTPException(status_code=403, detail="Quiz not published")

    if str(quiz.ai_generation_status or "").upper() == "CLOSED":
        raise HTTPException(status_code=410, detail="Exam has ended")

    runtime_settings = await _load_runtime_settings(db, quiz)
    verification_schema = runtime_settings["verification"]
    verification_context = verification_schema.get("context") or str(payload.verification_context or quiz.academic_type or "college").lower()
    return await _create_attempt(
        db=db,
        quiz=quiz,
        verification_context=verification_context,
        verification_data=payload.verification_data,
    )


@router.get("/{quiz_id}/entry-config", response_model=ExamEntryConfigResponse)
async def get_attempt_entry_config(
    quiz_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Quiz).where(Quiz.id == quiz_id))
    quiz = result.scalar_one_or_none()

    if not quiz or not quiz.is_published:
        raise HTTPException(status_code=404, detail="Quiz not available")

    runtime_settings = await _load_runtime_settings(db, quiz)
    return ExamEntryConfigResponse(
        quiz_id=quiz.id,
        quiz_title=quiz.title,
        academic_type=quiz.academic_type,
        require_fullscreen=runtime_settings["require_fullscreen"],
        violation_limit=runtime_settings["violation_limit"],
        verification=runtime_settings["verification"],
    )


@router.get("/public/{public_exam_id}/entry-config", response_model=ExamEntryConfigResponse)
async def get_public_attempt_entry_config(
    public_exam_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Quiz).where(Quiz.public_id == public_exam_id))
    quiz = result.scalar_one_or_none()

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    if not quiz.is_published:
        raise HTTPException(status_code=403, detail="Quiz not published")
    if str(quiz.ai_generation_status or "").upper() == "CLOSED":
        raise HTTPException(status_code=410, detail="Exam has ended")

    runtime_settings = await _load_runtime_settings(db, quiz)
    return ExamEntryConfigResponse(
        quiz_id=quiz.id,
        quiz_title=quiz.title,
        academic_type=quiz.academic_type,
        require_fullscreen=runtime_settings["require_fullscreen"],
        violation_limit=runtime_settings["violation_limit"],
        verification=runtime_settings["verification"],
    )


@router.post("/{attempt_id}/submit", response_model=SubmitAttemptResponse)
async def submit_attempt(
    attempt_id: uuid.UUID,
    x_attempt_token: str | None = Header(default=None, alias="X-Attempt-Token"),
    db: AsyncSession = Depends(get_db),
):

    result = await db.execute(select(Attempt).where(Attempt.id == attempt_id))
    attempt = result.scalar_one_or_none()

    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    _validate_attempt_token(attempt, x_attempt_token)

    if attempt.submitted_at:
        return SubmitAttemptResponse(
            message="Exam already submitted",
            submitted_at=attempt.submitted_at,
        )

    # Mark submission timestamp
    attempt.submitted_at = datetime.now(timezone.utc)
    attempt.status = "SUBMITTED"
    await db.commit()
    await _grade_attempt(db, str(attempt_id))
    await db.refresh(attempt)

    return SubmitAttemptResponse(
        message="Exam submitted successfully",
        submitted_at=attempt.submitted_at,
    )


@router.post("/{attempt_id}/heartbeat")
async def heartbeat_attempt(
    attempt_id: uuid.UUID,
    x_attempt_token: str | None = Header(default=None, alias="X-Attempt-Token"),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Attempt).where(Attempt.id == attempt_id))
    attempt = result.scalar_one_or_none()

    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    _validate_attempt_token(attempt, x_attempt_token)

    if attempt.submitted_at:
        raise HTTPException(status_code=409, detail="Attempt already submitted")

    if await exam_expired(str(attempt_id)):
        raise HTTPException(status_code=410, detail="Exam time expired")

    await set_heartbeat(str(attempt_id))
    remaining_time = await get_remaining_time(str(attempt_id))
    normalized_remaining = remaining_time if remaining_time and remaining_time > 0 else 0

    return {"message": "Heartbeat received", "remaining_time": normalized_remaining}


@router.get("/{attempt_id}/status")
async def get_attempt_status(
    attempt_id: uuid.UUID,
    x_attempt_token: str | None = Header(default=None, alias="X-Attempt-Token"),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Attempt).where(Attempt.id == attempt_id))
    attempt = result.scalar_one_or_none()

    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    _validate_attempt_token(attempt, x_attempt_token)

    remaining_time = await get_remaining_time(str(attempt_id))
    normalized_remaining = remaining_time if remaining_time and remaining_time > 0 else 0
    is_submitted = attempt.submitted_at is not None

    if attempt.status == "GRADED":
        attempt_status = "GRADED"
    elif is_submitted:
        attempt_status = "SUBMITTED"
    elif normalized_remaining <= 0:
        attempt_status = "EXPIRED"
    else:
        attempt_status = "IN_PROGRESS"

    return {
        "attempt_id": str(attempt.id),
        "remaining_time": normalized_remaining,
        "status": attempt_status,
        "submitted_at": attempt.submitted_at,
        "final_score": attempt.final_score,
    }
