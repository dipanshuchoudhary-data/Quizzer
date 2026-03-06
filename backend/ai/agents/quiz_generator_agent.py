from backend.core.llm import structured_llm_call
from backend.ai.schemas.generation import QuizGenerationOutput, GeneratedQuestion


async def generate_quiz(enhanced_prompt: str):

    prompt = f"""
You are a controlled quiz generation engine.

Your task is to generate exam questions EXACTLY according to
the structured instruction provided below.

STRICT RULES:
1. Follow every constraint defined in the instruction.
2. Do NOT modify the scope.
3. Do NOT introduce new topics.
4. Do NOT assume missing information.
5. Do NOT add creative explanations.
6. Do NOT include reasoning or commentary.
7. Output must strictly match the required structured format.
8. If any requirement is unclear, follow it literally without interpretation.

INSTRUCTION:
{enhanced_prompt}

EXECUTION REQUIREMENTS:
- Adhere strictly to defined question count.
- Respect difficulty distribution.
- Respect question types.
- Respect mark allocation.
- Ensure all questions remain within the allowed content scope.
- Ensure output is clean structured JSON only.

Return only the structured output.
"""

    return await structured_llm_call(prompt, QuizGenerationOutput)


async def generate_single_question(
    enhanced_prompt: str,
    question_type: str,
    marks: int,
    section_title: str,
    question_number: int,
    total_questions: int,
):
    prompt = f"""
You are a controlled quiz generation engine.

Generate exactly ONE question in strict JSON schema.

BASE INSTRUCTION:
{enhanced_prompt}

QUESTION SLOT CONSTRAINTS:
- Section: {section_title}
- Question number: {question_number} of {total_questions}
- Required question_type: {question_type}
- Required marks: {marks}

STRICT RULES:
1. Return exactly one question object.
2. Do not include explanations or commentary.
3. Follow question_type exactly.
4. If question_type is TRUE_FALSE, options must be ["True","False"].
5. If question_type is SHORT_ANSWER or LONG_ANSWER, keep options as null and correct_answer as null.
6. If question_type is MCQ, include options and correct_answer.
7. Keep content within the BASE INSTRUCTION scope.

Return strict JSON only.
"""
    return await structured_llm_call(prompt, GeneratedQuestion)
