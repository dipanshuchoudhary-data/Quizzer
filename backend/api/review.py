import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.core.database import get_db
from backend.api.deps import get_current_user

from backend.models.question import Question
from backend.models.quiz import Quiz
from backend.models.quiz_section import QuizSection
from backend.models.user import User


router = APIRouter(prefix="/review", tags=["Review"])


# -----------------------------------------------------
# Get generated questions for a quiz
# -----------------------------------------------------
@router.get("/{quiz_id}")
async def get_generated_questions(
    quiz_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    # Verify quiz exists
    quiz = await db.get(Quiz, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    result = await db.execute(
        select(Question)
        .join(QuizSection, Question.section_id == QuizSection.id)
        .where(QuizSection.quiz_id == quiz_id)
    )

    questions = result.scalars().all()

    return questions


# -----------------------------------------------------
# Approve question
# -----------------------------------------------------
@router.post("/approve/{question_id}")
async def approve_question(
    question_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    question = await db.get(Question, question_id)

    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    question.status = "APPROVED"
    await db.commit()

    return {"message": "Question approved"}
