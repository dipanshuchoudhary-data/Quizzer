import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.core.database import get_db
from backend.models.quiz import Quiz
from backend.models.attempt import Attempt
from backend.models.question import Question
from backend.models.student_profile import StudentProfile
from backend.models.result import Result
from backend.schemas.attempt import (
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


router = APIRouter(prefix="/attempts", tags=["Attempts"])


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
    student_name: str,
    enrollment_number: str,
    institution_type: str,
    course: str | None = None,
    section: str | None = None,
    batch: str | None = None,
    semester: str | None = None,
    class_name: str | None = None,
    class_section: str | None = None,
) -> StartAttemptResponse:
    questions = await _load_attempt_questions(db, quiz.id)
    if not questions:
        raise HTTPException(status_code=410, detail="Exam has ended")

    existing_attempt_result = await db.execute(
        select(Attempt).where(
            Attempt.quiz_id == quiz.id,
            Attempt.enrollment_number == enrollment_number,
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
        enrollment_number=enrollment_number,
        status="IN_PROGRESS",
        final_score=0,
        questions_snapshot=_serialize_question_snapshot(questions),
    )

    db.add(attempt)
    await db.flush()

    profile = StudentProfile(
        attempt_id=attempt.id,
        student_name=student_name,
        enrollment_number=enrollment_number,
        institution_type=institution_type,
        course=course,
        section=section,
        batch=batch,
        semester=semester,
        class_name=class_name,
        class_section=class_section,
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

    if str(payload.institution_type).lower() not in {"college", "school"}:
        raise HTTPException(status_code=400, detail="Institution type must be School or College")

    return await _create_attempt(
        db=db,
        quiz=quiz,
        student_name=payload.student_name,
        enrollment_number=payload.enrollment_number,
        institution_type=payload.institution_type.lower(),
        course=payload.course,
        section=payload.section,
        batch=payload.batch,
        semester=payload.semester,
        class_name=payload.class_name,
        class_section=payload.class_section,
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

    guest_suffix = payload.public_exam_id[:8].upper()
    return await _create_attempt(
        db=db,
        quiz=quiz,
        student_name=payload.student_name,
        enrollment_number=payload.enrollment_number or f"PUBLIC-{guest_suffix}",
        institution_type=payload.institution_type.lower(),
        course=payload.course,
        section=payload.section,
        batch=payload.batch,
        semester=payload.semester,
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
