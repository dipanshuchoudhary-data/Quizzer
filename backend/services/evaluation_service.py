from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.models.answer import Answer
from backend.models.question import Question
from backend.models.result import Result
from backend.models.violation import Violation


async def evaluate_attempt(db: AsyncSession, attempt_id):

    total_score = 0
    pending_review = False

    answers_result = await db.execute(
        select(Answer).where(Answer.attempt_id == attempt_id)
    )
    answers = answers_result.scalars().all()

    for ans in answers:
        question_result = await db.execute(
            select(Question).where(Question.id == ans.question_id)
        )
        question = question_result.scalar_one_or_none()

        if not question:
            continue

        # Objective types only
        if question.question_type in ["mcq", "true_false", "one_word"]:

            # Missing correct answer → mandatory review
            if not question.correct_answer:
                pending_review = True
                continue

            if ans.answer_text.strip().lower() == question.correct_answer.strip().lower():
                total_score += question.marks

    # Violation count
    violation_result = await db.execute(
        select(Violation).where(Violation.attempt_id == attempt_id)
    )
    violations = violation_result.scalars().all()
    violation_count = len(violations)

    integrity_flag = violation_count > 3

    status = "PENDING_PROFESSOR_REVIEW" if pending_review else "COMPLETED"

    result = Result(
        attempt_id=attempt_id,
        final_score=total_score,
        violation_count=violation_count,
        integrity_flag=integrity_flag,
        status=status,
    )

    db.add(result)
    await db.commit()

    return result
