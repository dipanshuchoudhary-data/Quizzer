from backend.core.llm import structured_llm_call
from backend.ai.schemas.generation import QuizGenerationOutput


async def generate_missing_answers(questions: list):

    prompt = f"""
You are an academic answer validation and completion engine.

Your task is to generate correct answers ONLY for questions
that do not already contain an answer.

STRICT RULES:
1. Do NOT modify existing answers.
2. Do NOT rewrite questions.
3. Do NOT change question wording.
4. Do NOT introduce new questions.
5. Do NOT guess if the correct answer is uncertain.
6. If a question is ambiguous or lacks sufficient information,
   return "answer_unavailable" for that question.
7. Do NOT provide reasoning or explanation.
8. Output must strictly match the structured schema.

ANSWER GENERATION RULES:
- Base answers strictly on the question text.
- Do NOT assume additional context.
- Do NOT expand beyond what is logically derivable.
- For MCQs: return only the correct option.
- For short answer: return concise, precise answer.
- For numerical questions: return exact value if determinable.
- If multiple correct answers are possible and ambiguity exists,
  return correct_answer: null
confidence: "low"


INPUT QUESTIONS:
{questions}

Return structured JSON only.
"""

    return await structured_llm_call(prompt, QuizGenerationOutput)
