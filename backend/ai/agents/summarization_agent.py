from backend.core.llm import structured_llm_call
from backend.ai.schemas.summarization import DocumentSummary


async def summarize_document(text: str):

    prompt = f"""
You are an academic content analyzer.

Your task is to analyze ONLY the provided content and generate a structured summary
to assist in exam question generation.

STRICT RULES:
1. Use ONLY the information present in the provided content.
2. Do NOT add external facts, assumptions, or examples.
3. Do NOT infer missing information.
4. If something is unclear, rely strictly on what is explicitly stated.
5. Keep the output factual and objective.

OBJECTIVES:

1. Concise Summary:
   - 5–10 sentences maximum.
   - Capture core concepts and learning points.
   - No interpretation beyond the text.

2. Key Topics:
   - Extract major themes or concepts explicitly mentioned.
   - Provide a clean bullet-style list.
   - Avoid generic labels like "important concepts".

3. Difficulty Level:
   Determine difficulty based on:
   - "easy" → basic definitions, simple explanations.
   - "medium" → conceptual understanding required.
   - "hard" → technical depth, advanced reasoning, formulas, or complex theory.
   Choose ONLY one: easy | medium | hard.

CONTENT TO ANALYZE:
{text[:8000]}

Return structured JSON only.
"""

    return await structured_llm_call(prompt, DocumentSummary)
