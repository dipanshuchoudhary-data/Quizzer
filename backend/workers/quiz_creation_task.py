import asyncio
import logging
import re
import sys
import uuid
from types import SimpleNamespace

from sqlalchemy import select

from backend.workers.celery_app import celery_app
from backend.ai.graphs.quiz_creation_graph import build_quiz_creation_graph
from backend.ai.agents.answer_key_agent import generate_missing_answers
from backend.workers.task_db import get_task_sessionmaker
from backend.services.question_quality import sanitize_question_candidate, normalize_question_type as normalize_question_type_shared, map_marks_to_question_type

from backend.models.quiz import Quiz
from backend.models.quiz_section import QuizSection
from backend.models.question import Question
from backend.models.ai_job import AIJob
from backend.core.llm import structured_llm_call
from backend.ai.schemas.generation import QuizGenerationOutput

logger = logging.getLogger(__name__)

if sys.platform.startswith("win"):
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


def normalize_question_type(value: str | None) -> str:
    return normalize_question_type_shared(value)


def friendly_question_type(value: str) -> str:
    token = normalize_question_type(value)
    if token == "MCQ":
        return "MCQ"
    if token == "TRUE_FALSE":
        return "True/False"
    if token == "SHORT_ANSWER":
        return "Short Answer"
    if token == "LONG_ANSWER":
        return "Long Answer"
    return token.title()


def default_section_title(index: int, question_type: str) -> str:
    return f"Section {index + 1}: {friendly_question_type(question_type)}"


def _normalize_question_type_token(value: str | None) -> str | None:
    token = str(value or "").strip().upper().replace("-", "_").replace(" ", "_").replace("/", "_")
    aliases = {
        "MCQ": "MCQ",
        "TRUEFALSE": "TRUE_FALSE",
        "TRUE_FALSE": "TRUE_FALSE",
        "BOOLEAN": "TRUE_FALSE",
        "TF": "TRUE_FALSE",
        "SHORTANSWER": "SHORT_ANSWER",
        "SHORT_ANSWER": "SHORT_ANSWER",
        "SHORTANS": "SHORT_ANSWER",
        "SA": "SHORT_ANSWER",
        "LONGANSWER": "LONG_ANSWER",
        "LONG_ANSWER": "LONG_ANSWER",
        "LA": "LONG_ANSWER",
    }
    return aliases.get(token)


def _parse_section_question_types(section: dict, section_idx: int) -> list[str]:
    raw_types = section.get("question_types")
    legacy_type = section.get("questionType") or section.get("question_type")

    if raw_types is None:
        if legacy_type is None:
            return ["MCQ"]
        raw_types = [legacy_type]

    if not isinstance(raw_types, list):
        raise ValueError(f"Section {section_idx + 1}: question_types must be a list")
    if len(raw_types) == 0:
        raise ValueError(f"Section {section_idx + 1}: question_types must not be empty")

    normalized: list[str] = []
    for raw in raw_types:
        mapped = _normalize_question_type_token(str(raw))
        if not mapped:
            raise ValueError(f"Section {section_idx + 1}: invalid question type '{raw}'")
        if mapped not in normalized:
            normalized.append(mapped)

    if len(normalized) == 0:
        raise ValueError(f"Section {section_idx + 1}: question_types must not be empty")
    return normalized


def _distribute_question_counts(total: int, type_count: int) -> list[int]:
    base = total // type_count
    remainder = total % type_count
    return [base + (1 if idx < remainder else 0) for idx in range(type_count)]


def get_blueprint_sections(blueprint: dict) -> list[dict]:
    sections = blueprint.get("sections", [])
    if not isinstance(sections, list) or len(sections) == 0:
        return []

    parsed: list[dict] = []
    for idx, section in enumerate(sections):
        if not isinstance(section, dict):
            continue

        raw_count = section.get("numberOfQuestions") or section.get("number_of_questions") or 1
        try:
            number_of_questions = int(raw_count)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Section {idx + 1}: number_of_questions must be an integer") from exc
        if number_of_questions <= 0:
            raise ValueError(f"Section {idx + 1}: number_of_questions must be greater than 0")

        question_types = _parse_section_question_types(section, idx)
        raw_title = str(section.get("title") or "").strip()
        is_generic = bool(re.fullmatch(r"section\s*\d+", raw_title, flags=re.IGNORECASE))

        distributed_counts = _distribute_question_counts(number_of_questions, len(question_types))
        for type_idx, question_type in enumerate(question_types):
            allocated_count = distributed_counts[type_idx]
            if allocated_count <= 0:
                continue
            if raw_title and not is_generic:
                resolved_title = raw_title if len(question_types) == 1 else f"{raw_title} - {friendly_question_type(question_type)}"
            else:
                resolved_title = default_section_title(len(parsed), question_type)

            parsed.append(
                {
                    "index": len(parsed),
                    "title": resolved_title,
                    "number_of_questions": allocated_count,
                    "question_type": question_type,
                    "marks_per_question": max(1, int(section.get("marksPerQuestion") or section.get("marks_per_question") or 1)),
                }
            )
    return parsed


async def build_fallback_blueprint_sections(db, quiz_id: str) -> list[dict]:
    sections_result = await db.execute(
        select(QuizSection).where(QuizSection.quiz_id == quiz_id).order_by(QuizSection.created_at.asc())
    )
    db_sections = sections_result.scalars().all()

    if not db_sections:
        return [
            {
                "index": 0,
                "title": default_section_title(0, "MCQ"),
                "number_of_questions": 5,
                "question_type": "MCQ",
                "marks_per_question": 1,
            }
        ]

    parsed: list[dict] = []
    for idx, section in enumerate(db_sections):
        total_marks = max(1, int(getattr(section, "total_marks", 1) or 1))
        estimated_count = max(1, min(30, total_marks // 2 if total_marks > 2 else total_marks))
        marks_per_question = max(1, total_marks // estimated_count)
        parsed.append(
            {
                "index": idx,
                "title": section.title or default_section_title(idx, "MCQ"),
                "number_of_questions": estimated_count,
                "question_type": "MCQ",
                "marks_per_question": marks_per_question,
            }
        )
    return parsed


def enforce_blueprint(generated_questions: list, blueprint_sections: list[dict]) -> tuple[list[tuple[dict, object]], str | None]:
    total_required = sum(section["number_of_questions"] for section in blueprint_sections)
    if len(generated_questions) < total_required:
        return [], f"Only generated {len(generated_questions)} questions, required {total_required}."

    pool = list(generated_questions)
    selected: list[tuple[dict, object]] = []
    deficits: list[str] = []

    for section in blueprint_sections:
        need = section["number_of_questions"]
        qtype = section["question_type"]

        matching = [q for q in pool if normalize_question_type(getattr(q, "question_type", None)) == qtype]
        take = matching[:need]

        if len(take) < need:
            fallback_count = need - len(take)
            fallback = [q for q in pool if q not in take][:fallback_count]
            take.extend(fallback)
            deficits.append(f"{section['title']}: requested {need} {qtype}, matched {len(matching)} before fallback.")

        if len(take) < need:
            return [], f"Insufficient questions for section '{section['title']}'."

        for q in take:
            if q in pool:
                pool.remove(q)
            selected.append((section, q))

    feedback = "; ".join(deficits) if deficits else None
    return selected, feedback


def missing_answers_count(pairs: list[tuple[dict, object]]) -> int:
    return sum(
        1
        for section_spec, q in pairs
        if _requires_strict_answer(section_spec.get("question_type") or getattr(q, "question_type", None))
        and (
            not getattr(q, "correct_answer", None)
            or str(getattr(q, "correct_answer", "")).strip() in {"", "answer_unavailable"}
        )
    )


def _is_missing_answer(value: object) -> bool:
    token = str(value or "").strip().lower()
    return token in {"", "answer_unavailable", "null", "none"}


def _requires_strict_answer(question_type: object) -> bool:
    return normalize_question_type(str(question_type or "")) in {"MCQ", "TRUE_FALSE"}


async def enrich_missing_answers(pairs: list[tuple[dict, object]]) -> list[tuple[dict, object]]:
    if not pairs:
        return pairs

    current = list(pairs)
    for _ in range(2):
        if missing_answers_count(current) == 0:
            break
        objective_indexes = [
            index
            for index, (section_spec, q) in enumerate(current)
            if _requires_strict_answer(section_spec.get("question_type") or getattr(q, "question_type", None))
            and _is_missing_answer(getattr(q, "correct_answer", None))
        ]
        if not objective_indexes:
            break

        objective_questions = [current[index][1] for index in objective_indexes]
        relative_by_index = {source_index: relative_index for relative_index, source_index in enumerate(objective_indexes)}
        output = await generate_missing_answers(objective_questions)
        updated = getattr(output, "questions", None) or []
        if not updated:
            break

        merged: list[tuple[dict, object]] = []
        for idx, (section_spec, original_question) in enumerate(current):
            if idx in relative_by_index:
                relative_index = relative_by_index[idx]
                candidate = updated[relative_index] if relative_index < len(updated) else None
                next_answer = getattr(candidate, "correct_answer", None) if candidate else None
                if not _is_missing_answer(next_answer):
                    setattr(original_question, "correct_answer", str(next_answer).strip())
            merged.append((section_spec, original_question))
        current = merged

    return current


def _map_option_answer_to_text(answer: str, options: list[str]) -> str:
    cleaned = answer.strip()
    if not cleaned:
        return ""
    token = cleaned.lower().strip()
    token = re.sub(r"^[\(\[\s]+", "", token)
    token = re.sub(r"[\)\].,:;\s]+$", "", token)
    token = re.split(r"\s+", token, maxsplit=1)[0]
    token = re.sub(r"[^a-z0-9]", "", token)
    if token in {"a", "b", "c", "d"}:
        idx = ord(token) - ord("a")
        if 0 <= idx < len(options):
            return options[idx]
    if token in {"1", "2", "3", "4"}:
        idx = int(token) - 1
        if 0 <= idx < len(options):
            return options[idx]
    return cleaned


def infer_blueprint_sections_from_source(source_questions: list[SimpleNamespace]) -> list[dict]:
    if not source_questions:
        return []

    order: list[tuple[str, str, int]] = [
        ("MCQ", "MCQ", 1),
        ("TRUE_FALSE", "True/False", 1),
        ("SHORT_ANSWER", "Short Answer", 2),
        ("LONG_ANSWER", "Long Answer", 5),
    ]
    grouped: dict[str, list[int]] = {qtype: [] for qtype, _, _ in order}
    counts: dict[str, int] = {qtype: 0 for qtype, _, _ in order}

    for q in source_questions:
        qtype = normalize_question_type(getattr(q, "question_type", None))
        if qtype not in counts:
            qtype = "MCQ"
        counts[qtype] += 1
        marks = getattr(q, "marks", None)
        if isinstance(marks, int) and marks > 0:
            grouped[qtype].append(marks)

    inferred: list[dict] = []
    for qtype, title, default_marks in order:
        count = counts[qtype]
        if count <= 0:
            continue
        marks_values = grouped[qtype]
        marks_per_question = max(
            1,
            int(round(sum(marks_values) / len(marks_values))) if marks_values else default_marks,
        )
        inferred.append(
            {
                "index": len(inferred),
                "title": title,
                "number_of_questions": count,
                "question_type": qtype,
                "marks_per_question": marks_per_question,
            }
        )

    return inferred


def parse_questions_from_source(extracted_text: str) -> list[SimpleNamespace]:
    raw = extracted_text.replace("\r\n", "\n")
    if not raw.strip():
        return []

    # Keep line boundaries for option parsing while normalizing noisy spacing.
    normalized = re.sub(r"[ \t]+", " ", raw)
    start_pattern = re.compile(r"(?im)^(?:q(?:uestion)?\s*\d+\s*[\).:-]?|[0-9]{1,3}\s*[\).:-])\s*")
    starts = list(start_pattern.finditer(normalized))
    if not starts:
        return []

    option_line = re.compile(r"(?im)^\s*(?:[\(\[]?\s*[a-d]\s*[\)\].:-]|[1-4][\).:-])\s*(.+)$")
    inline_option = re.compile(r"(?is)(?:^|\s)(?:[\(\[]?\s*([a-d])\s*[\)\].:-]|([1-4])[\).:-])\s*(.+?)(?=(?:\s(?:[\(\[]?\s*[a-d]\s*[\)\].:-]|[1-4][\).:-])\s*)|$)")
    answer_line = re.compile(r"(?im)\b(?:answer|ans|correct\s*answer)\s*[:\-]\s*([^\n]+)")
    answer_token = re.compile(r"(?im)\b(?:answer|ans|correct\s*answer|correct\s*option)\s*[:\-]?\s*(?:option\s*)?[\(\[]?\s*([a-d]|[1-4]|true|false)\s*[\)\]]?")
    answer_marker = re.compile(r"(?im)\b(?:answer|ans|correct\s*answer|correct\s*option)\b")
    marks_line = re.compile(r"(?i)(?:\(|\[)?\s*([0-9]{1,2})\s*marks?\s*(?:\)|\])?")

    parsed: list[SimpleNamespace] = []
    for idx, start in enumerate(starts):
        block_start = start.start()
        block_end = starts[idx + 1].start() if idx + 1 < len(starts) else len(normalized)
        block = normalized[block_start:block_end].strip()
        if not block:
            continue

        # Remove leading numbering token.
        question_text = re.sub(r"(?im)^(?:q(?:uestion)?\s*\d+\s*[\).:-]?|[0-9]{1,3}\s*[\).:-])\s*", "", block, count=1).strip()
        question_body = answer_marker.split(question_text, maxsplit=1)[0]

        option_matches = list(option_line.finditer(question_body))
        options = [match.group(1).strip() for match in option_matches]
        if len(options) < 2:
            options = [match.group(3).strip(" .;") for match in inline_option.finditer(question_body)]
        if options:
            options = [re.sub(r"(?i)\s*(?:\(|\[)?\s*[0-9]{1,2}\s*marks?\s*(?:\)|\])?\s*$", "", opt).strip() for opt in options]

        ans_match = answer_line.search(block)
        answer = ans_match.group(1).strip() if ans_match else ""
        if not answer:
            token_match = answer_token.search(block)
            answer = token_match.group(1).strip() if token_match else ""
        answer = _map_option_answer_to_text(answer, options)

        q_type = "MCQ" if len(options) >= 2 else "SHORT_ANSWER"
        # T/F detection based on options, inline wording, or answer token.
        joined_options = " ".join(options).lower()
        lower_block = block.lower()
        has_true_false_pair = ("true" in joined_options and "false" in joined_options) or bool(
            re.search(r"\btrue\s*/?\s*false\b|\bt\s*/\s*f\b", lower_block)
        )
        if has_true_false_pair or answer.lower() in {"true", "false"}:
            q_type = "TRUE_FALSE"
            options = ["True", "False"]
            if answer.lower() in {"t", "1"}:
                answer = "True"
            elif answer.lower() in {"f", "0"}:
                answer = "False"

        mark_match = marks_line.search(block)
        marks = int(mark_match.group(1)) if mark_match else None

        if marks is not None:
            if q_type in {"MCQ", "SHORT_ANSWER"}:
                q_type = map_marks_to_question_type(marks, fallback=q_type)

        # Keep only the stem before the first option marker.
        if option_matches:
            question_text = question_body[:option_matches[0].start()].strip()
        else:
            question_text = option_line.split(question_text)[0].strip()
            question_text = re.split(r"(?is)\s(?:[\(\[]?\s*a\s*[\)\].:-]|1[\).:-])\s*", question_text, maxsplit=1)[0].strip()
        question_text = re.sub(r"(?im)\b(?:answer|ans|correct\s*answer)\s*[:\-].*$", "", question_text).strip()
        if not question_text:
            continue

        sanitized = sanitize_question_candidate(
            question_text=question_text,
            question_type=q_type,
            options=options if options else None,
            correct_answer=answer or None,
            marks=marks,
        )
        if sanitized:
            parsed.append(sanitized)

    return parsed


def sanitize_generated_questions(questions: list[object]) -> list[SimpleNamespace]:
    cleaned: list[SimpleNamespace] = []
    for question in questions:
        sanitized = sanitize_question_candidate(
            question_text=getattr(question, "question_text", ""),
            question_type=getattr(question, "question_type", "MCQ"),
            options=getattr(question, "options", None),
            correct_answer=getattr(question, "correct_answer", None),
            marks=getattr(question, "marks", 1),
        )
        if sanitized:
            cleaned.append(sanitized)
    return cleaned


def pick_from_source(source_questions: list[SimpleNamespace], blueprint_sections: list[dict]) -> list[tuple[dict, object]]:
    pool = list(source_questions)
    selected: list[tuple[dict, object]] = []

    for section in blueprint_sections:
        needed = section["number_of_questions"]
        qtype = section["question_type"]
        matches = [q for q in pool if normalize_question_type(getattr(q, "question_type", None)) == qtype]
        take = matches[:needed]
        for q in take:
            pool.remove(q)
            selected.append((section, q))

    return selected


def fill_missing_from_ai(
    base_pairs: list[tuple[dict, object]],
    ai_questions: list,
    blueprint_sections: list[dict],
) -> tuple[list[tuple[dict, object]], str | None]:
    selected = list(base_pairs)
    used_ai: list[object] = []
    feedback: list[str] = []

    for section in blueprint_sections:
        have = sum(1 for sec, _ in selected if sec["index"] == section["index"])
        need = max(0, section["number_of_questions"] - have)
        if need == 0:
            continue

        qtype = section["question_type"]
        available = [
            q for q in ai_questions
            if q not in used_ai and normalize_question_type(getattr(q, "question_type", None)) == qtype
        ]
        chosen = available[:need]
        if len(chosen) < need:
            fallback = [q for q in ai_questions if q not in used_ai and q not in chosen][: need - len(chosen)]
            chosen.extend(fallback)
            feedback.append(f"{section['title']}: fallback used for {need - len(available[:need])} questions.")

        if len(chosen) < need:
            return [], f"Could not fill required count for section '{section['title']}'."

        for q in chosen:
            used_ai.append(q)
            selected.append((section, q))

    return selected, "; ".join(feedback) if feedback else None


async def extract_questions_verbatim_with_llm(extracted_text: str, blueprint_sections: list[dict]) -> list:
    total_required = sum(section["number_of_questions"] for section in blueprint_sections)
    constraints = [
        {
            "title": section["title"],
            "question_type": section["question_type"],
            "number_of_questions": section["number_of_questions"],
            "marks_per_question": section["marks_per_question"],
        }
        for section in blueprint_sections
    ]

    prompt = f"""
You are a strict question extractor.

Goal:
Extract questions and answers that ALREADY EXIST in the source text.
Do NOT create new questions. Do NOT paraphrase heavily.

Rules:
1. Use only source text content.
2. Preserve wording as close as possible.
3. For MCQ/TRUE_FALSE include options and correct_answer.
4. If answer is present as option letter (A/B/C/D), map to actual option text.
5. Follow blueprint counts/types/marks exactly when possible.
6. If source has fewer than requested for any type, return only what is available for that type.
7. Output strict JSON matching schema.

Blueprint constraints:
{constraints}

Required total target:
{total_required}

SOURCE TEXT:
{extracted_text[:45000]}
"""

    result = await structured_llm_call(prompt, QuizGenerationOutput)
    return result.questions


async def extract_all_questions_with_llm(extracted_text: str) -> list:
    prompt = f"""
You are a strict question extractor.

Goal:
Extract ALL questions that exist in the source text.
Do NOT create new questions and do NOT skip mid/late questions.

Rules:
1. Preserve original wording as closely as possible.
2. Include question_type as one of: MCQ, TRUE_FALSE, SHORT_ANSWER, LONG_ANSWER.
3. Include options for MCQ/TRUE_FALSE when present.
4. Include correct_answer only if it is explicitly present in source.
5. Include marks when explicitly present, otherwise use 1.
6. Return as many valid questions as present in source text.
7. Output strict JSON matching schema.

SOURCE TEXT:
{extracted_text[:45000]}
"""

    result = await structured_llm_call(prompt, QuizGenerationOutput)
    return result.questions


@celery_app.task(name="create_quiz_ai", bind=True, max_retries=1)
def create_quiz_ai(
    self,
    job_id: str,
    quiz_id: str,
    extracted_text: str,
    blueprint: dict,
    professor_note: str | None,
):
    logger.info(f"Starting quiz generation: job_id={job_id}, quiz_id={quiz_id}")

    async def _run():
        graph = build_quiz_creation_graph()

        SessionLocal = get_task_sessionmaker()
        async with SessionLocal() as db:
            job = await db.get(AIJob, job_id)
            if not job:
                job = AIJob(
                    id=uuid.UUID(str(job_id)),
                    quiz_id=quiz_id,
                    job_type="QUIZ_CREATION",
                    status="PROCESSING",
                )
                db.add(job)
                await db.commit()
                await db.refresh(job)
            else:
                job.status = "PROCESSING"
                await db.commit()

            quiz = None
            try:
                quiz = await db.get(Quiz, quiz_id)
                if not quiz:
                    raise ValueError("Quiz not found")

                quiz.ai_generation_status = "PROCESSING"
                job.meta = {
                    "source_mode": blueprint.get("source_mode"),
                    "source_references": blueprint.get("source_references", []),
                    "stage": "parsing_source",
                    "progress": 10,
                }
                await db.commit()

                blueprint_sections = get_blueprint_sections(blueprint)
                if not blueprint_sections:
                    blueprint_sections = await build_fallback_blueprint_sections(db, quiz_id)
                strict_source_alignment = bool(blueprint.get("strict_source_alignment"))
                auto_detect_structure = bool(blueprint.get("auto_detect_structure"))

                selected_pairs: list[tuple[dict, object]] = []
                retry_note = professor_note
                last_feedback = ""

                source_questions = parse_questions_from_source(extracted_text)
                job.meta = {**(job.meta or {}), "stage": "topic_detection", "progress": 25}
                await db.commit()
                default_5_mcq = (
                    len(blueprint_sections) == 1
                    and blueprint_sections[0]["number_of_questions"] == 5
                    and blueprint_sections[0]["question_type"] == "MCQ"
                )

                # Fallback: PDFs with noisy OCR often parse only top few questions via regex.
                # In auto mode, use an LLM extraction pass to recover full source question set.
                if auto_detect_structure and (len(source_questions) <= 5 or default_5_mcq):
                    llm_all = await extract_all_questions_with_llm(extracted_text)
                    if llm_all:
                        by_text: dict[str, object] = {}
                        for q in [*source_questions, *llm_all]:
                            key = re.sub(r"\s+", " ", str(getattr(q, "question_text", "")).strip().lower())
                            if key and key not in by_text:
                                by_text[key] = q
                        source_questions = list(by_text.values())

                if auto_detect_structure and source_questions:
                    inferred_sections = infer_blueprint_sections_from_source(source_questions)
                    if inferred_sections:
                        requested_total = sum(section["number_of_questions"] for section in blueprint_sections)
                        inferred_total = sum(section["number_of_questions"] for section in inferred_sections)
                        requested_types = {section["question_type"] for section in blueprint_sections}
                        inferred_types = {section["question_type"] for section in inferred_sections}
                        if (
                            inferred_total > requested_total
                            or len(inferred_types) > len(requested_types)
                            or default_5_mcq
                        ):
                            blueprint_sections = inferred_sections

                from_source = pick_from_source(source_questions, blueprint_sections)
                counts_needed = sum(section["number_of_questions"] for section in blueprint_sections)

                if strict_source_alignment and len(from_source) < counts_needed:
                    llm_extracted = await extract_questions_verbatim_with_llm(extracted_text, blueprint_sections)
                    by_text: dict[str, object] = {}
                    for q in [*source_questions, *llm_extracted]:
                        key = re.sub(r"\s+", " ", str(getattr(q, "question_text", "")).strip().lower())
                        if key and key not in by_text:
                            by_text[key] = q
                    merged_source = list(by_text.values())
                    from_source = pick_from_source(merged_source, blueprint_sections)

                if from_source:
                    if len(from_source) == counts_needed:
                        selected_pairs = from_source
                    else:
                        last_feedback = (
                            f"Source parsing filled {len(from_source)}/{counts_needed}. Filling remaining from AI."
                        )
                elif strict_source_alignment:
                    raise ValueError(
                        "Strict source alignment is ON, but no parseable questions were found in source text."
                    )

                for _ in range(3):
                    if selected_pairs:
                        break
                    job.meta = {**(job.meta or {}), "stage": "question_generation", "progress": 50}
                    await db.commit()
                    result = await graph.ainvoke(
                        {
                            "extracted_text": extracted_text,
                            "blueprint": blueprint,
                            "professor_note": retry_note,
                        }
                    )
                    cleaned_questions = sanitize_generated_questions(result["questions"])

                    if from_source:
                        selected_pairs, feedback = fill_missing_from_ai(from_source, cleaned_questions, blueprint_sections)
                    else:
                        selected_pairs, feedback = enforce_blueprint(cleaned_questions, blueprint_sections)
                    if not selected_pairs:
                        last_feedback = feedback or "Failed blueprint enforcement."
                        retry_note = (
                            (professor_note or "")
                            + " STRICT RETRY: Generate EXACTLY according to blueprint counts/types/marks. "
                            + last_feedback
                        ).strip()
                        continue

                    missing = missing_answers_count(selected_pairs)
                    if missing > 0:
                        last_feedback = f"{missing} questions missing correct_answer."
                        # Use targeted answer enrichment later instead of re-running the full generation graph.
                        break

                    break

                if selected_pairs and missing_answers_count(selected_pairs) > 0:
                    job.meta = {**(job.meta or {}), "stage": "answer_generation", "progress": 70}
                    await db.commit()
                    selected_pairs = await enrich_missing_answers(selected_pairs)

                if not selected_pairs:
                    if strict_source_alignment:
                        raise ValueError(
                            "Strict source alignment is ON and source questions did not fully satisfy blueprint."
                        )
                    raise ValueError(f"AI output failed blueprint requirements after retries. {last_feedback}")

                if missing_answers_count(selected_pairs) > 0:
                    normalized_pairs: list[tuple[dict, object]] = []
                    for section_spec, q in selected_pairs:
                        answer = getattr(q, "correct_answer", None)
                        if _requires_strict_answer(section_spec.get("question_type") or getattr(q, "question_type", None)) and _is_missing_answer(answer):
                            setattr(q, "correct_answer", "answer_unavailable")
                        normalized_pairs.append((section_spec, q))
                    selected_pairs = normalized_pairs

                sections_result = await db.execute(
                    select(QuizSection).where(QuizSection.quiz_id == quiz_id).order_by(QuizSection.created_at.asc())
                )
                db_sections = sections_result.scalars().all()

                if not db_sections:
                    for spec in blueprint_sections:
                        missing_section = QuizSection(
                            quiz_id=quiz.id,
                            title=spec["title"],
                            total_marks=spec["number_of_questions"] * spec["marks_per_question"],
                        )
                        db.add(missing_section)
                    await db.commit()
                    sections_result = await db.execute(
                        select(QuizSection).where(QuizSection.quiz_id == quiz_id).order_by(QuizSection.created_at.asc())
                    )
                    db_sections = sections_result.scalars().all()

                if len(db_sections) < len(blueprint_sections):
                    for idx in range(len(db_sections), len(blueprint_sections)):
                        spec = blueprint_sections[idx]
                        missing_section = QuizSection(
                            quiz_id=quiz.id,
                            title=spec["title"],
                            total_marks=spec["number_of_questions"] * spec["marks_per_question"],
                        )
                        db.add(missing_section)
                    await db.commit()
                    sections_result = await db.execute(
                        select(QuizSection).where(QuizSection.quiz_id == quiz_id).order_by(QuizSection.created_at.asc())
                    )
                    db_sections = sections_result.scalars().all()

                order_cursor: dict[int, int] = {}
                for section_spec, q in selected_pairs:
                    section_index = section_spec["index"]
                    target_section = db_sections[section_index]
                    target_type = section_spec["question_type"]
                    target_marks = section_spec["marks_per_question"]
                    sanitized = sanitize_question_candidate(
                        question_text=getattr(q, "question_text", ""),
                        question_type=target_type,
                        options=getattr(q, "options", None),
                        correct_answer=getattr(q, "correct_answer", None),
                        marks=target_marks,
                    )
                    if not sanitized:
                        raise ValueError(f"Invalid generated question detected for section '{section_spec['title']}'.")
                    options = sanitized.options
                    correct_answer = str(getattr(sanitized, "correct_answer", "")).strip()

                    if target_type == "TRUE_FALSE":
                        options = ["True", "False"]
                        lowered = correct_answer.lower()
                        if lowered in {"true", "t", "1"}:
                            correct_answer = "True"
                        elif lowered in {"false", "f", "0"}:
                            correct_answer = "False"
                    elif target_type in {"SHORT_ANSWER", "LONG_ANSWER"}:
                        correct_answer = ""

                    question = Question(
                        quiz_id=quiz.id,
                        section_id=target_section.id,
                        question_text=sanitized.question_text,
                        question_type=target_type,
                        options=options,
                        correct_answer=correct_answer,
                        marks=target_marks,
                        status="DRAFT",
                        order_index=order_cursor.get(section_index, 0) + 1,
                    )
                    order_cursor[section_index] = order_cursor.get(section_index, 0) + 1
                    db.add(question)

                quiz.ai_generation_status = "GENERATED"
                job.status = "COMPLETED"
                job.meta = {
                    **(job.meta or {}),
                    "generated_count": len(selected_pairs),
                    "stage": "difficulty_calibration",
                    "progress": 100,
                }
                await db.commit()
                logger.info(f"Quiz generation COMPLETED: job_id={job_id}, questions={len(selected_pairs)}")

            except Exception as e:
                logger.exception(f"Quiz generation FAILED: job_id={job_id}, error={e}")
                if quiz:
                    quiz.ai_generation_status = "FAILED"
                job.status = "FAILED"
                job.meta = {**(job.meta or {}), "error": str(e)}
                await db.commit()
                raise

    try:
        asyncio.run(_run())
    except Exception as e:
        logger.exception(f"Fatal error in quiz generation: job_id={job_id}, error={e}")
        # Try to mark as failed even on fatal error
        try:
            async def _mark_failed():
                SessionLocal = get_task_sessionmaker()
                async with SessionLocal() as db:
                    job = await db.get(AIJob, job_id)
                    quiz = await db.get(Quiz, quiz_id)
                    if job:
                        job.status = "FAILED"
                        job.meta = {**(job.meta or {}), "error": f"Fatal: {str(e)}"}
                    if quiz:
                        quiz.ai_generation_status = "FAILED"
                    await db.commit()
            asyncio.run(_mark_failed())
        except Exception:
            logger.exception(f"Could not mark job {job_id} as failed")
        raise
