import uuid
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.core.database import get_db
from backend.models.answer import Answer
from backend.models.attempt import Attempt
from backend.models.question import Question
from backend.schemas.answer import SaveAnswerRequest, SaveAnswerResponse
from backend.core.redis import exam_expired


router = APIRouter(prefix="/answers", tags=["Answers"])


def _validate_attempt_token(attempt: Attempt, provided_token: str | None) -> None:
    if not provided_token or provided_token != attempt.attempt_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid attempt token",
        )


@router.post("/{attempt_id}", response_model=SaveAnswerResponse)
async def save_answer(
    attempt_id: uuid.UUID,
    payload: SaveAnswerRequest,
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

    question_result = await db.execute(
        select(Question).where(
            Question.id == payload.question_id,
            Question.quiz_id == attempt.quiz_id,
        )
    )
    question = question_result.scalar_one_or_none()

    if not question:
        raise HTTPException(status_code=404, detail="Question not found for this attempt")

    # Upsert behavior
    result = await db.execute(
        select(Answer).where(
            Answer.attempt_id == attempt_id,
            Answer.question_id == payload.question_id,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.answer_text = payload.answer_text
    else:
        answer = Answer(
            attempt_id=attempt_id,
            question_id=payload.question_id,
            answer_text=payload.answer_text,
        )
        db.add(answer)

    await db.commit()

    return SaveAnswerResponse(message="Answer saved", question_id=payload.question_id)
