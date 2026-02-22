import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.core.database import get_db
from backend.api.deps import get_current_user
from backend.models.quiz import Quiz
from backend.models.quiz_section import QuizSection
from backend.models.question import Question
from backend.models.user import User
from backend.workers.quiz_creation_task import create_quiz_ai


router = APIRouter(prefix="/quizzes", tags=["Quizzes"])


# --------------------------------------------------
# Create Quiz
# --------------------------------------------------

@router.post("/")
async def create_quiz(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    if payload.get("academic_type") not in ["college", "school"]:
        raise HTTPException(
            status_code=400,
            detail="academic_type must be 'college' or 'school'",
        )

    quiz = Quiz(
        title=payload.get("title"),
        description=payload.get("description"),
        academic_type=payload.get("academic_type"),
        created_by=current_user.id,
    )

    db.add(quiz)
    await db.commit()
    await db.refresh(quiz)

    return quiz


# --------------------------------------------------
# List Quizzes (Professor)
# --------------------------------------------------

@router.get("/")
async def list_quizzes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    result = await db.execute(
        select(Quiz).where(Quiz.created_by == current_user.id)
    )

    return result.scalars().all()


# --------------------------------------------------
# Get Quiz Detail
# --------------------------------------------------

@router.get("/{quiz_id}")
async def get_quiz(
    quiz_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    quiz = await db.get(Quiz, quiz_id)

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    return quiz


# --------------------------------------------------
# Create Section (Manual)
# --------------------------------------------------

@router.post("/{quiz_id}/sections")
async def create_section(
    quiz_id: uuid.UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    quiz = await db.get(Quiz, quiz_id)

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    section = QuizSection(
        quiz_id=quiz_id,
        title=payload.get("title"),
        total_marks=payload.get("total_marks"),
    )

    db.add(section)
    await db.commit()
    await db.refresh(section)

    return section


# --------------------------------------------------
# Trigger AI Quiz Generation
# --------------------------------------------------

@router.post("/{quiz_id}/generate-ai")
async def generate_ai_quiz(
    quiz_id: uuid.UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    quiz = await db.get(Quiz, quiz_id)

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    if quiz.ai_generation_status == "PROCESSING":
        raise HTTPException(
            status_code=400,
            detail="AI generation already in progress",
        )

    extracted_text = payload.get("extracted_text")
    blueprint = payload.get("blueprint")
    professor_note = payload.get("professor_note")

    if not extracted_text or not blueprint:
        raise HTTPException(
            status_code=400,
            detail="extracted_text and blueprint required",
        )

    create_quiz_ai.delay(
        str(quiz_id),
        extracted_text,
        blueprint,
        professor_note,
    )

    return {"message": "AI generation started"}


# --------------------------------------------------
# Publish Quiz
# --------------------------------------------------

@router.post("/{quiz_id}/publish")
async def publish_quiz(
    quiz_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    quiz = await db.get(Quiz, quiz_id)

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    # Ensure all questions approved
    result = await db.execute(
        select(Question).join(QuizSection).where(
            QuizSection.quiz_id == quiz_id,
            Question.status != "APPROVED",
        )
    )

    unapproved = result.scalars().first()

    if unapproved:
        raise HTTPException(
            status_code=400,
            detail="All questions must be approved before publishing",
        )

    quiz.is_published = True
    quiz.ai_generation_status = "APPROVED"

    await db.commit()

    return {"message": "Quiz published successfully"}
