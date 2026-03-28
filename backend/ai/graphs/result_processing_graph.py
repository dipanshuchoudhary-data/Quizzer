from langgraph.graph import StateGraph, START, END
from typing import TypedDict
from sqlalchemy import select
import logging

from backend.models.answer import Answer
from backend.models.violation import Violation
from backend.models.result import Result
from backend.models.attempt import Attempt
from backend.ai.agents.short_answer_evaluator import evaluate_short_answers
from backend.ai.agents.answer_key_agent import generate_missing_answers
from backend.services.question_quality import normalize_question_type, normalize_math_text


logger = logging.getLogger(__name__)


class ResultGraphState(TypedDict):
    db: object
    attempt_id: str
    objective_score: int
    short_answer_payload: list
    short_answer_scores: list
    violation_count: int
    final_score: int
    review_required: bool


def _is_missing_answer_key(value: object) -> bool:
    token = str(value or "").strip().lower()
    return token in {"", "answer_unavailable", "null", "none"}


async def _build_short_answer_payload(snapshot: list[dict], answers_map: dict[str, str]) -> tuple[list[dict], bool]:
    payload: list[dict] = []
    fallback_candidates: list[dict] = []
    fallback_indexes: list[int] = []

    for question in snapshot:
        question_id = str(question.get("id") or "")
        payload_item = {
            "question_id": question_id,
            "question_text": str(question.get("question_text") or ""),
            "student_answer": answers_map.get(question_id, ""),
            "correct_answer": str(question.get("correct_answer") or ""),
            "max_marks": int(question.get("marks") or 1),
        }
        payload.append(payload_item)
        if _is_missing_answer_key(payload_item["correct_answer"]):
            fallback_candidates.append(
                {
                    "question_text": payload_item["question_text"],
                    "question_type": str(question.get("question_type") or "SHORT_ANSWER"),
                    "correct_answer": None,
                    "marks": payload_item["max_marks"],
                }
            )
            fallback_indexes.append(len(payload) - 1)

    review_required = False
    if fallback_candidates:
        generated = await generate_missing_answers(fallback_candidates)
        generated_questions = getattr(generated, "questions", []) or []
        for idx, generated_question in zip(fallback_indexes, generated_questions):
            candidate_answer = str(getattr(generated_question, "correct_answer", "") or "").strip()
            if _is_missing_answer_key(candidate_answer):
                review_required = True
                continue
            payload[idx]["correct_answer"] = candidate_answer

        if any(_is_missing_answer_key(payload[idx]["correct_answer"]) for idx in fallback_indexes):
            review_required = True

    return payload, review_required


# --------------------------------------------------
# Nodes
# --------------------------------------------------

async def objective_node(state: ResultGraphState):

    db = state["db"]
    attempt_id = state["attempt_id"]

    total_score = 0
    short_answer_questions = []
    review_required = False

    attempt = await db.get(Attempt, attempt_id)
    if not attempt:
        logger.warning("Grading skipped because attempt %s was not found", attempt_id)
        return {
            "objective_score": 0,
            "short_answer_payload": [],
            "review_required": True,
        }

    snapshot = list(getattr(attempt, "questions_snapshot", None) or [])
    if not snapshot:
        logger.warning("Attempt %s has no question snapshot; objective grading cannot run", attempt_id)

    answers_result = await db.execute(select(Answer).where(Answer.attempt_id == attempt_id))
    answers = answers_result.scalars().all()
    answers_map = {str(answer.question_id): str(answer.answer_text or "") for answer in answers}

    correct_answers = 0
    total_questions = len(snapshot)

    for question in snapshot:
        question_id = str(question.get("id") or "")
        normalized_qtype = normalize_question_type(question.get("question_type"))
        student_answer = answers_map.get(question_id, "")
        correct_answer = str(question.get("correct_answer") or "")
        marks = int(question.get("marks") or 1)

        if normalized_qtype in ["MCQ", "TRUE_FALSE", "ONE_WORD"]:
            if not correct_answer or correct_answer == "answer_unavailable":
                review_required = True
                continue

            if normalize_math_text(student_answer).strip().lower() == normalize_math_text(correct_answer).strip().lower():
                total_score += marks
                correct_answers += 1

        elif normalized_qtype in {"SHORT_ANSWER", "LONG_ANSWER"}:
            short_answer_questions.append(question)

    short_answer_payload, short_answer_review_required = await _build_short_answer_payload(short_answer_questions, answers_map)
    review_required = review_required or short_answer_review_required

    logger.info(
        "Grading attempt %s | Questions: %s | Answers Stored: %s | Correct answers: %s | Final score pre-subjective: %s",
        attempt_id,
        total_questions,
        len(answers_map),
        correct_answers,
        total_score,
    )

    return {
        "objective_score": total_score,
        "short_answer_payload": short_answer_payload,
        "review_required": review_required,
    }


async def short_answer_node(state: ResultGraphState):

    if not state["short_answer_payload"]:
        return {"short_answer_scores": []}

    result = await evaluate_short_answers(state["short_answer_payload"])

    return {"short_answer_scores": result.results}


async def aggregate_node(state: ResultGraphState):

    total_score = state["objective_score"]
    review_required = state["review_required"]

    for item in state["short_answer_scores"]:
        total_score += item.awarded_marks

    db = state["db"]
    attempt_id = state["attempt_id"]

    violation_result = await db.execute(
        select(Violation).where(Violation.attempt_id == attempt_id)
    )

    violations = violation_result.scalars().all()
    violation_count = len(violations)
    penalty = violation_count // 2

    integrity_flag = violation_count > 3
    total_score = max(0, total_score - penalty)

    status = (
        "PENDING_PROFESSOR_REVIEW"
        if review_required
        else "COMPLETED"
    )

    existing_result_result = await db.execute(
        select(Result).where(Result.attempt_id == attempt_id)
    )
    result = existing_result_result.scalar_one_or_none()
    if result:
        result.final_score = total_score
        result.violation_count = violation_count
        result.integrity_flag = integrity_flag
        result.status = "GRADED" if not review_required else status
    else:
        result = Result(
            attempt_id=attempt_id,
            final_score=total_score,
            violation_count=violation_count,
            integrity_flag=integrity_flag,
            status="GRADED" if not review_required else status,
        )
        db.add(result)

    attempt = await db.get(Attempt, attempt_id)
    if attempt:
        attempt.final_score = total_score
        attempt.status = "GRADED" if not review_required else "SUBMITTED"

    await db.commit()

    return {
        "final_score": total_score,
        "violation_count": violation_count,
    }


# --------------------------------------------------
# Graph Builder
# --------------------------------------------------

def build_result_processing_graph():

    graph = StateGraph(ResultGraphState)
    ## Nodes 
    graph.add_node("objective", objective_node)
    graph.add_node("short_answer", short_answer_node)
    graph.add_node("aggregate", aggregate_node)

    ## Nodes -- connection
    graph.add_edge(START, "objective")
    graph.add_edge("objective", "short_answer")
    graph.add_edge("short_answer", "aggregate")
    graph.add_edge("aggregate", END)

    return graph.compile()
