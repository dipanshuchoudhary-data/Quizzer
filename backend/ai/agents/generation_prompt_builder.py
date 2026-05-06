def _blueprint_to_instruction(blueprint: dict | list[dict]) -> str:
    sections = blueprint if isinstance(blueprint, list) else blueprint.get("sections", []) if isinstance(blueprint, dict) else []
    if not isinstance(sections, list) or not sections:
        return "Create 5 MCQ questions."
    lines: list[str] = []
    for idx, section in enumerate(sections, start=1):
        if not isinstance(section, dict):
            continue
        count = int(section.get("number_of_questions") or section.get("numberOfQuestions") or 1)
        qtype = str(section.get("question_type") or section.get("questionType") or "MCQ").strip()
        marks = int(section.get("marks_per_question") or section.get("marksPerQuestion") or 1)
        title = str(section.get("title") or f"Section {idx}").strip()
        lines.append(f"{title}: {count} {qtype} questions, {marks} marks each.")
    return " ".join(lines) if lines else "Create 5 MCQ questions."


def build_generation_prompt(
    summary_or_filtered_content: str,
    blueprint: dict | list[dict],
    professor_note: str | None = None,
) -> str:
    constraints = _blueprint_to_instruction(blueprint)
    note = professor_note.strip() if professor_note and professor_note.strip() else "None"
    content = (summary_or_filtered_content or "").strip()
    return f"""CONTENT:
{content}

TASK:
Generate quiz questions based on the content.

BLUEPRINT:
{constraints}

PROFESSOR_NOTE:
{note}

CONSTRAINTS:
* Use only provided content
* No hallucination
* No explanation
* You MUST include correct_answer for every question. Never leave it blank.

OUTPUT:
Return JSON:
{{
"questions": [
{{
"question": "string",
"options": ["string", "string", "string", "string"],
"answer": "string",
"difficulty": "easy | medium | hard"
}}
]
}}
* Output must be valid JSON only
* No extra text"""

