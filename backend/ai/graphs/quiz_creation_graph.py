from typing import Any, Dict, List, Optional, TypedDict

from langgraph.graph import END, START, StateGraph

from backend.workers.quiz_creation_task import (
    generate_quiz_questions_batched,
    get_blueprint_sections,
    parse_questions_from_source,
    sanitize_generated_questions,
)


class QuizGraphState(TypedDict):
    extracted_text: str
    summary: Optional[Any]
    generation_prompt: Optional[str]
    questions: Optional[List[Any]]
    blueprint: Dict[str, Any] | List[Dict[str, Any]]
    professor_note: Optional[str]


async def generate_batched_node(state: QuizGraphState):
    extracted_text = (state.get("extracted_text") or "").strip()
    if not extracted_text:
        raise ValueError("No extracted_text provided")

    blueprint = state.get("blueprint")
    if not blueprint:
        raise ValueError("Blueprint missing in state")

    blueprint_sections = get_blueprint_sections(blueprint)
    if not blueprint_sections:
        blueprint_sections = [
            {
                "index": 0,
                "title": "Section 1: MCQ",
                "number_of_questions": 5,
                "question_type": "MCQ",
                "marks_per_question": 1,
            }
        ]

    source_questions = parse_questions_from_source(extracted_text)
    questions = sanitize_generated_questions(
        await generate_quiz_questions_batched(
            extracted_text=extracted_text,
            blueprint_sections=blueprint_sections,
            professor_note=state.get("professor_note"),
            source_questions=source_questions,
            retry_feedback="compat_graph",
        )
    )

    if not questions:
        raise ValueError("Quiz generator failed to produce questions")

    return {
        "summary": None,
        "generation_prompt": None,
        "questions": questions,
    }


def build_quiz_creation_graph():
    graph = StateGraph(QuizGraphState)
    graph.add_node("generate_batched", generate_batched_node)
    graph.add_edge(START, "generate_batched")
    graph.add_edge("generate_batched", END)
    return graph.compile()
