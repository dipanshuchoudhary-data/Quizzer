import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.core.database import get_db
from backend.api.deps import get_current_user
from backend.models.quiz import Quiz
from backend.models.quiz_section import QuizSection
from backend.models.question import Question
from backend.models.user import User


router = APIRouter(prefix="/sections", tags=["Sections"])


@router.patch("/{section_id}")
async def update_section(
    section_id: uuid.UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    section = await db.get(QuizSection, section_id)
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    quiz = await db.get(Quiz, section.quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    if quiz.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this section")

    changed = False
    for field in ["title", "total_marks"]:
        if field in payload:
            if getattr(section, field) != payload[field]:
                changed = True
                setattr(section, field, payload[field])

    if changed:
        result = await db.execute(select(Question).where(Question.section_id == section.id))
        section_questions = result.scalars().all()
        for question in section_questions:
            question.status = "DRAFT"

        quiz.is_published = False
        if quiz.ai_generation_status != "PROCESSING":
            quiz.ai_generation_status = "GENERATED"

    await db.commit()
    await db.refresh(section)
    return section
