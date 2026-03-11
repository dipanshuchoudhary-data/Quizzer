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
from backend.services.question_quality import sanitize_question_candidate


router = APIRouter(prefix="/review", tags=["Review"])


async def _ensure_question_owner(
    question: Question,
    db: AsyncSession,
    current_user: User,
):
    section = await db.get(QuizSection, question.section_id)
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    quiz = await db.get(Quiz, section.quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    if quiz.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized for this quiz")


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

    if quiz.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized for this quiz")

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

    await _ensure_question_owner(question, db, current_user)
    sanitized = sanitize_question_candidate(
        question_text=question.question_text,
        question_type=question.question_type,
        options=question.options,
        correct_answer=question.correct_answer,
        marks=question.marks,
    )
    if not sanitized:
        raise HTTPException(status_code=400, detail="Question is malformed and cannot be approved")

    question.status = "APPROVED"
    await db.commit()

    return {"message": "Question approved"}


@router.post("/bulk/approve")
async def approve_many_questions(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    question_ids = payload.get("question_ids")
    if not isinstance(question_ids, list) or not question_ids:
        raise HTTPException(status_code=400, detail="question_ids must be a non-empty list")

    parsed_ids = []
    for question_id in question_ids:
        try:
            parsed_ids.append(uuid.UUID(question_id))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=f"Invalid question_id: {question_id}") from exc

    result = await db.execute(select(Question).where(Question.id.in_(parsed_ids)))
    questions = result.scalars().all()

    if len(questions) != len(parsed_ids):
        raise HTTPException(status_code=404, detail="One or more questions not found")

    for question in questions:
        await _ensure_question_owner(question, db, current_user)
        sanitized = sanitize_question_candidate(
            question_text=question.question_text,
            question_type=question.question_type,
            options=question.options,
            correct_answer=question.correct_answer,
            marks=question.marks,
        )
        if not sanitized:
            raise HTTPException(status_code=400, detail="One or more questions are malformed and cannot be approved")
        question.status = "APPROVED"

    await db.commit()
    return {"message": "Questions approved"}


@router.post("/bulk/move")
async def move_many_questions(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    question_ids = payload.get("question_ids")
    section_id = payload.get("section_id")

    if not isinstance(question_ids, list) or not question_ids:
        raise HTTPException(status_code=400, detail="question_ids must be a non-empty list")
    if not section_id:
        raise HTTPException(status_code=400, detail="section_id is required")

    try:
        target_section_id = uuid.UUID(section_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid section_id") from exc

    target_section = await db.get(QuizSection, target_section_id)
    if not target_section:
        raise HTTPException(status_code=404, detail="Target section not found")

    target_quiz = await db.get(Quiz, target_section.quiz_id)
    if not target_quiz or target_quiz.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized for target section")

    parsed_ids = []
    for question_id in question_ids:
        try:
            parsed_ids.append(uuid.UUID(question_id))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=f"Invalid question_id: {question_id}") from exc

    result = await db.execute(select(Question).where(Question.id.in_(parsed_ids)))
    questions = result.scalars().all()
    if len(questions) != len(parsed_ids):
        raise HTTPException(status_code=404, detail="One or more questions not found")

    for question in questions:
        await _ensure_question_owner(question, db, current_user)
        question.section_id = target_section.id
        question.quiz_id = target_section.quiz_id

    await db.commit()
    return {"message": "Questions moved"}


@router.post("/bulk/marks")
async def update_many_question_marks(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    question_ids = payload.get("question_ids")
    marks = payload.get("marks")

    if not isinstance(question_ids, list) or not question_ids:
        raise HTTPException(status_code=400, detail="question_ids must be a non-empty list")

    try:
        marks_value = int(marks)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="marks must be a number") from exc

    if marks_value <= 0:
        raise HTTPException(status_code=400, detail="marks must be greater than 0")

    parsed_ids = []
    for question_id in question_ids:
        try:
            parsed_ids.append(uuid.UUID(question_id))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=f"Invalid question_id: {question_id}") from exc

    result = await db.execute(select(Question).where(Question.id.in_(parsed_ids)))
    questions = result.scalars().all()
    if len(questions) != len(parsed_ids):
        raise HTTPException(status_code=404, detail="One or more questions not found")

    for question in questions:
        await _ensure_question_owner(question, db, current_user)
        question.marks = marks_value

    await db.commit()
    return {"message": "Marks updated"}
