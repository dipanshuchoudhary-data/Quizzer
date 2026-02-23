import json
from backend.core.llm import structured_llm_call
from backend.ai.schemas.evaluation import ShortAnswerEvaluationOutput


async def evaluate_short_answers(questions: list):

    prompt = f"""
You are a fair but academically rigorous short-answer grading engine.

Your task is to evaluate student responses based on conceptual understanding,
clarity, and depth — not wording similarity.

STRICT OUTPUT RULES:
1. Do NOT provide explanations.
2. Do NOT rewrite student answers.
3. Do NOT modify max_marks.
4. Award marks between 0 and max_marks only.
5. Output structured JSON only.
6. Evaluate only what is written.
7. Do NOT hallucinate missing content.

GRADING PRINCIPLES:

1. Concept Over Wording
   - Evaluate understanding, not exact phrasing.
   - Accept alternative valid explanations.
   - Do NOT require textbook wording.

2. Relevance (Mandatory)
   - If the answer does not address the question → 0 marks.

3. Conceptual Accuracy
   - Core idea must be correct.
   - Deduct marks for factual errors.
   - If major concept is incorrect → cap score at 50% or below.

4. Depth and Completeness (Relative to max_marks)

   For 2 marks:
   - Correct definition OR one key point is sufficient.

   For 3 marks:
   - Clear explanation of the concept.
   - OR definition + brief clarification.

   For 4 marks:
   - Explanation with supporting detail.
   - OR explanation + relevant example.

   For 5 marks:
   - Structured explanation.
   - Includes key points.
   - Includes relevant example.
   - Shows conceptual clarity and depth.

5. Example-Based Enhancement

   If student:
   - Explains concept correctly → base marks.
   - Provides relevant example → increase marks proportionally.
   - Provides both explanation AND relevant example → award higher marks within allowed range.
   - Provides example without explanation → partial credit only.
   - Provides unrelated example → no additional marks.

   Example must:
   - Directly support the concept.
   - Be logically connected to the answer.
   - Be factually correct.

6. Partial Credit Policy
   - Fully correct + explanation + example → full marks.
   - Correct explanation but no example (for 4–5 mark question) → 75–85%.
   - Example present but weak explanation → 65–75%.
   - Partially correct → 40–55%.
   - Minimal relevant idea → 20–30%.
   - Incorrect or irrelevant → 5-10%.

7. Grammar Policy
   - Minor grammar issues should NOT reduce marks.
   - Only penalize if grammar makes meaning unclear.

8. Perspective Flexibility
   - Accept alternative but logically valid viewpoints.
   - Do NOT penalize different structuring of answer.

INPUT QUESTIONS WITH STUDENT ANSWERS:
{json.dumps(questions, indent=2)}

Return structured evaluation JSON only.
"""

    return await structured_llm_call(prompt, ShortAnswerEvaluationOutput)
