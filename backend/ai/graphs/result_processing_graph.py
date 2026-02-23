from langgraph.graph import StateGraph, START, END
from typing import TypedDict
from sqlalchemy import select

from backend.models.answer import Answer
from backend.models.question import Question
from backend.models.violation import Violation
from backend.models.result import Result
from backend.ai.agents.short_answer_evaluator import evaluate_short_answers


class ResultGraphState(TypedDict):
    db: object
    attempt_id: str
    objective_score: int
    short_answer_payload: list
    short_answer_scores: list
    violation_count: int
    final_score: int
    review_required: bool


# --------------------------------------------------
# Nodes
# --------------------------------------------------

async def objective_node(state: ResultGraphState):

    db = state["db"]
    attempt_id = state["attempt_id"]

    total_score = 0
    short_answer_payload = []
    review_required = False

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

        if question.question_type in ["mcq", "true_false", "one_word"]:

            if (
                not question.correct_answer
                or question.correct_answer == "answer_unavailable"
            ):
                review_required = True
                continue

            if (
                ans.answer_text
                and ans.answer_text.strip().lower()
                == question.correct_answer.strip().lower()
            ):
                total_score += question.marks

        elif question.question_type == "short_answer":

            short_answer_payload.append(
                {
                    "question_id": str(question.id),
                    "student_answer": ans.answer_text,
                    "correct_answer": question.correct_answer,
                    "max_marks": question.marks,
                }
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

    integrity_flag = violation_count > 3

    status = (
        "PENDING_PROFESSOR_REVIEW"
        if review_required
        else "COMPLETED"
    )

    result = Result(
        attempt_id=attempt_id,
        final_score=total_score,
        violation_count=violation_count,
        integrity_flag=integrity_flag,
        status=status,
    )

    db.add(result)
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
