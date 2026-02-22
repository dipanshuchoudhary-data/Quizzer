import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.core.database import get_db
from backend.models.quiz import Quiz
from backend.models.attempt import Attempt
from backend.models.student_profile import StudentProfile
from backend.schemas.attempt import (
    StartAttemptRequest,
    StartAttemptResponse,
    SubmitAttemptResponse,
)
from backend.core.redis import (
    start_exam_timer,
    lock_attempt_session,
    exam_expired,
)
from backend.workers.result_processing_task import process_result


router = APIRouter(prefix="/attempts", tags=["Attempts"])

DEFAULT_DURATION_SECONDS = 3600


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

    attempt_token = str(uuid.uuid4())

    attempt = Attempt(
        quiz_id=quiz_id,
        attempt_token=attempt_token,
    )

    db.add(attempt)
    await db.flush()

    profile = StudentProfile(
        attempt_id=attempt.id,
        student_name=payload.student_name,
        enrollment_number=payload.enrollment_number,
        course=payload.course,
        section=payload.section,
        batch=payload.batch,
        semester=payload.semester,
        class_name=payload.class_name,
        class_section=payload.class_section,
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
    )


@router.post("/{attempt_id}/submit", response_model=SubmitAttemptResponse)
async def submit_attempt(
    attempt_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):

    result = await db.execute(select(Attempt).where(Attempt.id == attempt_id))
    attempt = result.scalar_one_or_none()

    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    # Mark submission timestamp
    attempt.submitted_at = datetime.utcnow()
    await db.commit()

    process_result.delay(str(attempt_id))

    return SubmitAttemptResponse(
        message="Exam submitted successfully",
        submitted_at=attempt.submitted_at,
    )
