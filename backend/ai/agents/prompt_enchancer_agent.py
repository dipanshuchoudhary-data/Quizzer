from backend.core.llm import structured_llm_call
from pydantic import BaseModel


class EnhancedPrompt(BaseModel):
    enhanced_prompt: str


async def enhance_prompt(
    summary: str,
    blueprint: dict,
    professor_note: str | None,
):

    prompt = f"""
You are a prompt optimization agent.

Your task is to improve the clarity, structure, and precision
of a user-provided exam generation instruction.

You MUST preserve the original intent.
You MUST NOT add new academic content.
You MUST NOT introduce new topics.
You MUST NOT hallucinate missing details.

STRICT RULES:
1. Do NOT change the meaning of the inputs.
2. Do NOT add assumptions.
3. Do NOT expand content scope beyond what is provided.
4. Do NOT explain reasoning.
5. Output only the improved prompt.
6. Keep the instruction deterministic and execution-ready.

INPUTS:

--- CONTENT SUMMARY ---
{summary}

--- EXAM BLUEPRINT (JSON) ---
{blueprint}

--- PROFESSOR NOTE ---
{professor_note or "None"}

OBJECTIVE:

Rewrite these inputs into a clear, structured, and unambiguous
instruction for an LLM that will generate exam questions.

The improved prompt MUST:

1. Clearly define:
   - Scope of content
   - Number and type of questions
   - Difficulty requirements
   - Any constraints from blueprint
   - Any constraints from professor note

2. Remove vague wording.
3. Replace ambiguous phrases with precise directives.
4. Specify formatting expectations for the final output.
5. Prevent hallucination by explicitly restricting content to the summary.

STRUCTURE THE OUTPUT USING SECTIONS:

- Objective
- Content Scope
- Constraints
- Question Requirements
- Output Format
- Prohibited Actions

Return only the final improved prompt text.
"""

    return await structured_llm_call(prompt, EnhancedPrompt)
