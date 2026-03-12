import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.models.answer import Answer
from backend.models.result import Result
from backend.models.violation import Violation
from backend.models.attempt import Attempt
from backend.services.question_quality import normalize_question_type, normalize_math_text


logger = logging.getLogger(__name__)


async def evaluate_attempt(db: AsyncSession, attempt_id):
    total_score = 0
    pending_review = False

    attempt = await db.get(Attempt, attempt_id)
    if not attempt:
        logger.warning("Evaluation skipped because attempt %s was not found", attempt_id)
        return None

    snapshot = list(getattr(attempt, "questions_snapshot", None) or [])
    if not snapshot:
        logger.warning("Attempt %s has no question snapshot; evaluation cannot grade objective answers", attempt_id)

    answers_result = await db.execute(select(Answer).where(Answer.attempt_id == attempt_id))
    answers = answers_result.scalars().all()
    answers_map = {str(answer.question_id): str(answer.answer_text or "") for answer in answers}

    total_questions = len(snapshot)
    correct_answers = 0

    for question in snapshot:
        normalized_qtype = normalize_question_type(question.get("question_type"))
        question_id = str(question.get("id") or "")
        correct_answer = str(question.get("correct_answer") or "")
        student_answer = answers_map.get(question_id, "")
        marks = int(question.get("marks") or 1)

        if normalized_qtype in {"MCQ", "TRUE_FALSE", "ONE_WORD"}:
            if not correct_answer or correct_answer == "answer_unavailable":
                pending_review = True
                continue

            if normalize_math_text(student_answer).strip().lower() == normalize_math_text(correct_answer).strip().lower():
                total_score += marks
                correct_answers += 1

    violation_result = await db.execute(select(Violation).where(Violation.attempt_id == attempt_id))
    violations = violation_result.scalars().all()
    violation_count = len(violations)
    total_score = max(0, total_score - (violation_count // 2))
    integrity_flag = violation_count > 3

    logger.info(
        "Grading attempt %s | Questions: %s | Answers Stored: %s | Correct answers: %s | Final score: %s",
        attempt_id,
        total_questions,
        len(answers_map),
        correct_answers,
        total_score,
    )

    status = "PENDING_PROFESSOR_REVIEW" if pending_review else "GRADED"

    result_row = await db.execute(select(Result).where(Result.attempt_id == attempt_id))
    result = result_row.scalar_one_or_none()
    if result:
        result.final_score = total_score
        result.violation_count = violation_count
        result.integrity_flag = integrity_flag
        result.status = status
    else:
        result = Result(
            attempt_id=attempt_id,
            final_score=total_score,
            violation_count=violation_count,
            integrity_flag=integrity_flag,
            status=status,
        )
        db.add(result)

    if attempt:
        attempt.final_score = total_score
        attempt.status = "GRADED" if not pending_review else "SUBMITTED"

    await db.commit()

    return result
