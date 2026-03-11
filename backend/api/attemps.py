import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.core.database import get_db
from backend.models.quiz import Quiz
from backend.models.attempt import Attempt
from backend.models.question import Question
from backend.models.student_profile import StudentProfile
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
from backend.workers.result_processing_task import process_result


router = APIRouter(prefix="/attempts", tags=["Attempts"])

DEFAULT_DURATION_SECONDS = 3600


async def _load_attempt_questions(db: AsyncSession, quiz_id: uuid.UUID) -> list[Question]:
    questions_result = await db.execute(
        select(Question)
        .where(Question.quiz_id == quiz_id, Question.status == "APPROVED")
        .order_by(Question.created_at.asc())
    )
    return questions_result.scalars().all()


async def _create_attempt(
    *,
    db: AsyncSession,
    quiz: Quiz,
    student_name: str,
    enrollment_number: str,
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

    attempt_token = str(uuid.uuid4())
    started_at = datetime.utcnow()
    expires_at = started_at + timedelta(seconds=DEFAULT_DURATION_SECONDS)

    attempt = Attempt(
        quiz_id=quiz.id,
        attempt_token=attempt_token,
    )

    db.add(attempt)
    await db.flush()

    profile = StudentProfile(
        attempt_id=attempt.id,
        student_name=student_name,
        enrollment_number=enrollment_number,
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

    await start_exam_timer(str(attempt.id), DEFAULT_DURATION_SECONDS)
    return StartAttemptResponse(
        attempt_id=attempt.id,
        attempt_token=attempt_token,
        duration_seconds=DEFAULT_DURATION_SECONDS,
        duration=DEFAULT_DURATION_SECONDS,
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

    # Validate academic structure
    if quiz.academic_type == "college":
        if not payload.course or not payload.batch or not payload.semester:
            raise HTTPException(
                status_code=400,
                detail="College fields missing",
            )

    if quiz.academic_type == "school":
        if not payload.class_name:
            raise HTTPException(
                status_code=400,
                detail="Class name required for school",
            )

    return await _create_attempt(
        db=db,
        quiz=quiz,
        student_name=payload.student_name,
        enrollment_number=payload.enrollment_number,
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
    result = await db.execute(select(Quiz).where(Quiz.public_slug == payload.public_exam_id))
    quiz = result.scalar_one_or_none()

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    if not quiz.is_published:
        raise HTTPException(status_code=403, detail="Quiz not published")

    if str(quiz.ai_generation_status or "").upper() == "CLOSED":
        raise HTTPException(status_code=410, detail="Exam has ended")

    questions = await _load_attempt_questions(db, quiz.id)
    if not questions:
        raise HTTPException(status_code=410, detail="Exam has ended")

    guest_suffix = payload.public_exam_id[:8].upper()
    return await _create_attempt(
        db=db,
        quiz=quiz,
        student_name="Guest Student",
        enrollment_number=f"PUBLIC-{guest_suffix}",
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
    attempt.submitted_at = datetime.utcnow()
    await db.commit()

    process_result.delay(str(attempt_id))

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

    if is_submitted:
        attempt_status = "SUBMITTED"
    elif normalized_remaining <= 0:
        attempt_status = "EXPIRED"
    else:
        attempt_status = "ACTIVE"

    return {
        "attempt_id": str(attempt.id),
        "remaining_time": normalized_remaining,
        "status": attempt_status,
        "submitted_at": attempt.submitted_at,
    }
