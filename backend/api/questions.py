import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.core.database import get_db
from backend.api.deps import get_current_user
from backend.models.user import User
from backend.models.quiz import Quiz
from backend.models.quiz_section import QuizSection
from backend.models.question import Question
from backend.services.question_quality import sanitize_question_candidate, normalize_question_type


router = APIRouter(prefix="/questions", tags=["Questions"])


def _sanitize_question_payload(payload: dict, current: Question | None = None) -> dict:
    question_type = payload.get("question_type", current.question_type if current else "MCQ")
    question_text = payload.get("question_text", current.question_text if current else "")
    options = payload.get("options", current.options if current else None)
    correct_answer = payload.get("correct_answer", current.correct_answer if current else None)
    marks = payload.get("marks", current.marks if current else 1)

    sanitized = sanitize_question_candidate(
        question_text=question_text,
        question_type=question_type,
        options=options,
        correct_answer=correct_answer,
        marks=marks,
    )
    if not sanitized:
        raise HTTPException(
            status_code=400,
            detail="Question content is invalid. Remove answer-key text and fix options before saving.",
        )

    normalized_type = normalize_question_type(question_type)
    updates = {
        "question_text": sanitized.question_text,
        "question_type": normalized_type,
        "marks": sanitized.marks,
    }
    if normalized_type in {"SHORT_ANSWER", "LONG_ANSWER"}:
        updates["options"] = None
        updates["correct_answer"] = None
    else:
        updates["options"] = sanitized.options
        updates["correct_answer"] = sanitized.correct_answer
    return updates


async def _mark_quiz_needs_republish(quiz_id: uuid.UUID, db: AsyncSession) -> None:
    quiz = await db.get(Quiz, quiz_id)
    if not quiz:
        return
    quiz.is_published = False
    if quiz.ai_generation_status != "PROCESSING":
        quiz.ai_generation_status = "GENERATED"


async def _ensure_section_owner(
    section_id: uuid.UUID,
    db: AsyncSession,
    user: User,
) -> QuizSection:
    section = await db.get(QuizSection, section_id)
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    quiz = await db.get(Quiz, section.quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    if quiz.created_by != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized for this quiz",
        )

    return section


async def _ensure_question_owner(
    question_id: uuid.UUID,
    db: AsyncSession,
    user: User,
) -> Question:
    question = await db.get(Question, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    await _ensure_section_owner(question.section_id, db, user)
    return question


@router.post("")
async def create_question(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    section_id = payload.get("section_id")
    if not section_id:
        raise HTTPException(status_code=400, detail="section_id is required")

    section = await _ensure_section_owner(uuid.UUID(section_id), db, current_user)

    sanitized = _sanitize_question_payload(payload)

    question = Question(
        quiz_id=section.quiz_id,
        section_id=section.id,
        question_text=sanitized["question_text"],
        question_type=sanitized["question_type"],
        difficulty=payload.get("difficulty") or "Medium",
        options=sanitized["options"],
        correct_answer=sanitized["correct_answer"],
        marks=sanitized["marks"],
        status=payload.get("status") or "DRAFT",
    )

    db.add(question)
    await _mark_quiz_needs_republish(section.quiz_id, db)
    await db.commit()
    await db.refresh(question)
    return question


@router.patch("/{question_id}")
async def update_question(
    question_id: uuid.UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    question = await _ensure_question_owner(question_id, db, current_user)
    changed = False

    normalized_payload = None
    question_fields = {"question_text", "question_type", "options", "correct_answer", "marks"}
    if any(field in payload for field in question_fields):
        normalized_payload = _sanitize_question_payload(payload, current=question)

    for field in [
        "question_text",
        "question_type",
        "difficulty",
        "options",
        "correct_answer",
        "marks",
    ]:
        if field in payload:
            next_value = normalized_payload[field] if normalized_payload and field in normalized_payload else payload[field]
            if getattr(question, field) != next_value:
                changed = True
                setattr(question, field, next_value)

    if "status" in payload and not changed:
        question.status = payload["status"]

    if "section_id" in payload:
        section_id = uuid.UUID(payload["section_id"])
        section = await _ensure_section_owner(section_id, db, current_user)
        if question.section_id != section.id:
            changed = True
            question.section_id = section.id

    if changed:
        question.status = "DRAFT"
        await _mark_quiz_needs_republish(question.quiz_id, db)

    await db.commit()
    await db.refresh(question)
    return question


@router.delete("/{question_id}")
async def delete_question(
    question_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    question = await _ensure_question_owner(question_id, db, current_user)
    await _mark_quiz_needs_republish(question.quiz_id, db)
    await db.delete(question)
    await db.commit()
    return {"message": "Question deleted"}


@router.post("/{question_id}/duplicate")
async def duplicate_question(
    question_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    source = await _ensure_question_owner(question_id, db, current_user)

    duplicated = Question(
        quiz_id=source.quiz_id,
        section_id=source.section_id,
        question_text=source.question_text,
        question_type=source.question_type,
        difficulty=source.difficulty,
        options=source.options,
        correct_answer=source.correct_answer,
        marks=source.marks,
        status="DRAFT",
    )
    db.add(duplicated)
    await _mark_quiz_needs_republish(source.quiz_id, db)
    await db.commit()
    await db.refresh(duplicated)
    return duplicated


@router.post("/{question_id}/regenerate")
async def regenerate_question(
    question_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    question = await _ensure_question_owner(question_id, db, current_user)

    # Placeholder deterministic regeneration until dedicated per-question
    # AI route is implemented.
    question.status = "DRAFT"
    question.question_text = f"{question.question_text} (Regenerated)"
    await _mark_quiz_needs_republish(question.quiz_id, db)
    await db.commit()
    await db.refresh(question)
    return question
