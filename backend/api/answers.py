import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.core.database import get_db
from backend.models.answer import Answer
from backend.models.attempt import Attempt
from backend.schemas.answer import SaveAnswerRequest, SaveAnswerResponse


router = APIRouter(prefix="/answers", tags=["Answers"])


@router.post("/{attempt_id}", response_model=SaveAnswerResponse)
async def save_answer(
    attempt_id: uuid.UUID,
    payload: SaveAnswerRequest,
    db: AsyncSession = Depends(get_db),
):

    result = await db.execute(select(Attempt).where(Attempt.id == attempt_id))
    attempt = result.scalar_one_or_none()

    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

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

    return SaveAnswerResponse(message="Answer saved")
