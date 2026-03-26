from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Optional, List, Dict, Any

from backend.ai.agents.summarization_agent import summarize_document
from backend.ai.agents.prompt_enchancer_agent import enhance_prompt
from backend.ai.agents.quiz_generator_agent import generate_quiz


class QuizGraphState(TypedDict):
    extracted_text: str
    summary: Optional[Any]          # Pydantic model stored directly
    enhanced_prompt: Optional[str]
    questions: Optional[List[Any]]
    blueprint: Dict[str, Any]
    professor_note: Optional[str]


# -------------------------
# Nodes
# -------------------------

async def summarize_node(state: QuizGraphState):

    if not state.get("extracted_text"):
        raise ValueError("No extracted_text provided")

    summary_obj = await summarize_document(state["extracted_text"])

    return {
        "summary": summary_obj  # Store model directly
    }


async def enhance_node(state: QuizGraphState):

    summary_obj = state.get("summary")

    if not summary_obj:
        raise ValueError("Summary missing in state")

    if not state.get("blueprint"):
        raise ValueError("Blueprint missing in state")

    enhanced = await enhance_prompt(
        summary=summary_obj.summary,  # Access attribute directly
        source_excerpt=state["extracted_text"][:12000],
        blueprint=state["blueprint"],
        professor_note=state.get("professor_note"),
    )

    if enhanced is None or not getattr(enhanced, "enhanced_prompt", None):
        raise ValueError("Enhance prompt agent failed")

    return {
        "enhanced_prompt": enhanced.enhanced_prompt
    }


async def generate_node(state: QuizGraphState):

    if not state.get("enhanced_prompt"):
        raise ValueError("Enhanced prompt missing before quiz generation")

    output = await generate_quiz(state["enhanced_prompt"])

    if output is None or not getattr(output, "questions", None):
        raise ValueError("Quiz generator failed to produce questions")

    return {
        "questions": output.questions
    }


# -------------------------
# Graph Builder
# -------------------------

def build_quiz_creation_graph():

    graph = StateGraph(QuizGraphState)

    # Nodes
    graph.add_node("summarize", summarize_node)
    graph.add_node("enhance", enhance_node)
    graph.add_node("generate", generate_node)

    # Flow
    graph.add_edge(START, "summarize")
    graph.add_edge("summarize", "enhance")
    graph.add_edge("enhance", "generate")
    graph.add_edge("generate", END)

    return graph.compile()
