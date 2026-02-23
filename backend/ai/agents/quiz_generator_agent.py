from backend.core.llm import structured_llm_call
from backend.ai.schemas.generation import QuizGenerationOutput


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
