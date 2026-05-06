import asyncio
import json
import logging
import re
import sys
import time
import uuid
from types import SimpleNamespace

from sqlalchemy import delete, insert, select

from backend.workers.celery_app import celery_app
from backend.workers.task_db import get_task_sessionmaker
from backend.services.question_quality import sanitize_question_candidate, normalize_question_type as normalize_question_type_shared, map_marks_to_question_type
from backend.ai.agents.generation_prompt_builder import build_generation_prompt

from backend.models.quiz import Quiz
from backend.models.quiz_section import QuizSection
from backend.models.question import Question
from backend.models.ai_job import AIJob
from backend.core.llm import structured_llm_call
from backend.ai.schemas.generation import QuizGenerationOutput

logger = logging.getLogger(__name__)

if sys.platform.startswith("win"):
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


SOURCE_EXTRACTION_LIMIT = 32000
GENERATION_SOURCE_LIMIT = 6000
LLM_SOURCE_LIMIT = 6000
QUESTION_SIGNAL_LIMIT = 12


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


def _truncate_source_text(text: str, limit: int) -> str:
    normalized = text.replace("\r\n", "\n").strip()
    if len(normalized) <= limit:
        return normalized

    head = max(1, int(limit * 0.7))
    tail = max(1, limit - head - len("\n...\n"))
    return f"{normalized[:head]}\n...\n{normalized[-tail:]}"


def _dedupe_questions_by_text(questions: list[object]) -> list[object]:
    by_text: dict[str, object] = {}
    for question in questions:
        key = re.sub(r"\s+", " ", str(getattr(question, "question_text", "")).strip().lower())
        if key and key not in by_text:
            by_text[key] = question
    return list(by_text.values())


def _build_question_signals(source_questions: list[SimpleNamespace], limit: int = QUESTION_SIGNAL_LIMIT) -> list[dict]:
    signals: list[dict] = []
    for question in source_questions[:limit]:
        signals.append(
            {
                "question_type": normalize_question_type(getattr(question, "question_type", None)),
                "marks": getattr(question, "marks", 1) or 1,
                "question_text": getattr(question, "question_text", ""),
            }
        )
    return signals


def detect_content_type(extracted_text: str) -> str:
    text = (extracted_text or "").strip()
    if not text:
        return "notes"

    question_hits = len(re.findall(r"(?im)(?:^|\n)\s*(?:q(?:uestion)?\s*\d+|[0-9]{1,3}[.)])", text))
    option_hits = len(re.findall(r"(?im)(?:^|\n)\s*(?:\(?[a-d]\)|[a-d][.)]|[1-4][.)])\s+\S+", text))
    answer_hits = len(re.findall(r"(?im)\b(?:answer|correct\s*answer|correct)\s*[:\-]", text))
    qmark_hits = text.count("?")

    qa_score = question_hits * 3 + option_hits * 2 + answer_hits * 3 + min(qmark_hits, 20)
    notes_score = len(re.findall(r"(?im)\b(?:introduction|overview|chapter|definition|concept|theory|example)\b", text))

    has_qa = question_hits > 0 or (option_hits >= 2 and answer_hits > 0) or qa_score >= 12
    has_notes = notes_score >= 4 or (len(text) > 2500 and question_hits <= 1 and answer_hits == 0)

    if has_qa and has_notes:
        return "mixed"
    if has_qa:
        return "question_bank"
    return "notes"


def extract_qa_payload(extracted_text: str) -> dict:
    parsed = parse_questions_from_source(extracted_text)
    questions = []
    for q in parsed:
        qtype = normalize_question_type(getattr(q, "question_type", None))
        options = getattr(q, "options", None)
        answer = str(getattr(q, "correct_answer", "") or "").strip()
        if qtype == "TRUE_FALSE":
            options = ["True", "False"]
            lowered = answer.lower()
            if lowered in {"t", "1"}:
                answer = "True"
            elif lowered in {"f", "0"}:
                answer = "False"
        elif qtype in {"SHORT_ANSWER", "LONG_ANSWER"}:
            options = None
        elif qtype == "MCQ" and not options:
            continue

        question_text = str(getattr(q, "question_text", "") or "").strip()
        if not question_text:
            continue
        questions.append(
            {
                "question": question_text,
                "options": options,
                "answer": answer,
            }
        )
    return {"questions": questions}


def _keyword_set(text: str) -> set[str]:
    return {token for token in re.findall(r"[a-z0-9]{3,}", (text or "").lower())}


def _score_chunk(chunk: str, keywords: set[str]) -> int:
    tokens = _keyword_set(chunk)
    overlap = len(tokens & keywords)
    signal_bonus = 3 if re.search(r"(?i)\b(question|answer|option|define|explain|true|false)\b", chunk) else 0
    return overlap * 5 + signal_bonus + min(len(chunk), 800) // 120


def _chunk_text(extracted_text: str, chunk_size: int = 1200) -> list[str]:
    normalized = (extracted_text or "").replace("\r\n", "\n").strip()
    if not normalized:
        return []
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n+", normalized) if p.strip()]
    if not paragraphs:
        paragraphs = [line.strip() for line in normalized.splitlines() if line.strip()]

    chunks: list[str] = []
    current = ""
    for para in paragraphs:
        candidate = f"{current}\n\n{para}".strip() if current else para
        if len(candidate) <= chunk_size:
            current = candidate
            continue
        if current:
            chunks.append(current)
        current = para[:chunk_size]
    if current:
        chunks.append(current)
    return chunks


def build_filtered_content(
    extracted_text: str,
    blueprint_sections: list[dict],
    professor_note: str | None,
    *,
    max_chars: int = LLM_SOURCE_LIMIT,
) -> tuple[str, str, dict]:
    content_type = detect_content_type(extracted_text)
    qa_payload = extract_qa_payload(extracted_text)
    qa_questions = qa_payload.get("questions", [])

    if content_type == "question_bank" and qa_questions:
        compact = json.dumps(qa_payload, ensure_ascii=True, separators=(",", ":"))
        return content_type, compact[:max_chars], qa_payload

    keywords = _keyword_set(
        " ".join(
            [
                professor_note or "",
                json.dumps(_serialize_blueprint_sections(blueprint_sections), ensure_ascii=True, separators=(",", ":")),
            ]
        )
    )
    chunks = _chunk_text(extracted_text)
    scored = sorted(
        [(_score_chunk(chunk, keywords), idx, chunk) for idx, chunk in enumerate(chunks)],
        key=lambda x: (-x[0], x[1]),
    )

    picked: list[str] = []
    used = 0
    for _, _, chunk in scored:
        fingerprint = re.sub(r"\W+", "", chunk.lower())[:160]
        if any(fingerprint and fingerprint in re.sub(r"\W+", "", p.lower()) for p in picked):
            continue
        if used >= max_chars:
            break
        room = max_chars - used
        part = chunk if len(chunk) <= room else chunk[:room]
        if not part.strip():
            continue
        picked.append(part.strip())
        used += len(part) + 2

    notes_content = "\n\n".join(picked).strip()[:max_chars]
    if content_type == "mixed" and qa_questions:
        qa_compact = json.dumps({"questions": qa_questions[:20]}, ensure_ascii=True, separators=(",", ":"))
        merged = f"EXTRACTED_QA:\n{qa_compact}\n\nTHEORY_CONTEXT:\n{notes_content}".strip()
        return content_type, merged[:max_chars], qa_payload

    return content_type, notes_content, qa_payload


def _serialize_blueprint_sections(blueprint_sections: list[dict]) -> list[dict]:
    return [
        {
            "title": section["title"],
            "question_type": section["question_type"],
            "number_of_questions": section["number_of_questions"],
            "marks_per_question": section["marks_per_question"],
        }
        for section in blueprint_sections
    ]


async def _set_job_stage(job, db, *, stage: str, progress: int, timings: dict[str, float] | None = None) -> None:
    meta = {**(job.meta or {}), "stage": stage, "progress": progress}
    if timings:
        meta["timings"] = {name: round(value, 3) for name, value in timings.items()}
    job.meta = meta
    await db.commit()


def _log_stage_timing(job_id: str, quiz_id: str, stage: str, started_at: float) -> float:
    elapsed = time.perf_counter() - started_at
    logger.info(
        "quiz_generation_timing job_id=%s quiz_id=%s stage=%s elapsed_s=%.3f",
        job_id,
        quiz_id,
        stage,
        elapsed,
    )
    return elapsed


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


def should_replace_blueprint_with_inferred_sections(
    requested_sections: list[dict],
    inferred_sections: list[dict],
    *,
    default_5_mcq: bool,
) -> bool:
    if not inferred_sections:
        return False
    if default_5_mcq:
        return True

    requested_total = sum(section["number_of_questions"] for section in requested_sections)
    inferred_total = sum(section["number_of_questions"] for section in inferred_sections)
    requested_types = {section["question_type"] for section in requested_sections}
    inferred_types = {section["question_type"] for section in inferred_sections}

    return inferred_total <= requested_total and len(inferred_types) > len(requested_types)


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


async def ensure_quiz_sections(db, quiz, blueprint_sections: list[dict]) -> list[SimpleNamespace]:
    sections_result = await db.execute(
        select(QuizSection).where(QuizSection.quiz_id == quiz.id).order_by(QuizSection.created_at.asc())
    )
    existing_sections = sections_result.scalars().all()
    resolved_sections = [
        SimpleNamespace(id=section.id, title=section.title, total_marks=section.total_marks)
        for section in existing_sections
    ]

    if len(resolved_sections) >= len(blueprint_sections):
        return resolved_sections

    section_rows: list[dict] = []
    for idx in range(len(resolved_sections), len(blueprint_sections)):
        spec = blueprint_sections[idx]
        section_rows.append(
            {
                "id": uuid.uuid4(),
                "quiz_id": quiz.id,
                "title": spec["title"],
                "total_marks": spec["number_of_questions"] * spec["marks_per_question"],
            }
        )

    if section_rows:
        await db.execute(insert(QuizSection), section_rows)
        resolved_sections.extend(
            SimpleNamespace(id=row["id"], title=row["title"], total_marks=row["total_marks"])
            for row in section_rows
        )

    return resolved_sections


async def extract_questions_verbatim_with_llm(extracted_text: str, blueprint_sections: list[dict]) -> list:
    source_questions = parse_questions_from_source(extracted_text)
    selected = pick_from_source(source_questions, blueprint_sections)
    return [q for _, q in selected]


async def extract_all_questions_with_llm(extracted_text: str) -> list:
    return parse_questions_from_source(extracted_text)


async def generate_quiz_questions_batched(
    extracted_text: str,
    blueprint_sections: list[dict],
    professor_note: str | None,
    source_questions: list[SimpleNamespace],
    retry_feedback: str = "",
) -> list:
    answer_strictness_note = "You MUST include correct_answer for every question. Never leave it blank."
    resolved_professor_note = (
        f"{professor_note.strip()} {answer_strictness_note}".strip()
        if professor_note and professor_note.strip()
        else answer_strictness_note
    )
    content_type, filtered_content, _qa_payload = build_filtered_content(
        extracted_text=extracted_text,
        blueprint_sections=blueprint_sections,
        professor_note=resolved_professor_note,
        max_chars=LLM_SOURCE_LIMIT,
    )
    summary_or_filtered_content = filtered_content
    if retry_feedback:
        summary_or_filtered_content = f"{filtered_content}\n\nRETRY_HINT:{retry_feedback[:300]}"
    prompt = build_generation_prompt(
        summary_or_filtered_content=summary_or_filtered_content,
        blueprint=blueprint_sections,
        professor_note=resolved_professor_note,
    )
    result = await structured_llm_call(prompt, QuizGenerationOutput)
    questions = result.questions
    if not questions:
        retry_prompt = build_generation_prompt(
            summary_or_filtered_content=summary_or_filtered_content[: max(1000, LLM_SOURCE_LIMIT // 2)],
            blueprint=blueprint_sections,
            professor_note=f"{resolved_professor_note} content_type={content_type}",
        )
        retry = await structured_llm_call(retry_prompt, QuizGenerationOutput)
        questions = retry.questions
    return questions


@celery_app.task(name="create_quiz_ai")
def create_quiz_ai(
    job_id: str,
    quiz_id: str,
    extracted_text: str,
    blueprint: dict,
    professor_note: str | None,
):
    logger.info(f"[START] Quiz generation: job_id={job_id}, quiz_id={quiz_id}")

    async def _run():
        total_started_at = time.perf_counter()
        stage_timings: dict[str, float] = {}

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
                default_5_mcq = (
                    len(blueprint_sections) == 1
                    and blueprint_sections[0]["number_of_questions"] == 5
                    and blueprint_sections[0]["question_type"] == "MCQ"
                )
                parse_started_at = time.perf_counter()
                source_questions = await asyncio.to_thread(parse_questions_from_source, extracted_text)

                stage_timings["parsing"] = _log_stage_timing(job_id, quiz_id, "parsing", parse_started_at)
                await _set_job_stage(job, db, stage="topic_detection", progress=25, timings=stage_timings)

                if auto_detect_structure and source_questions:
                    topic_detection_started_at = time.perf_counter()
                    inferred_sections = infer_blueprint_sections_from_source(source_questions)
                    if inferred_sections:
                        if should_replace_blueprint_with_inferred_sections(
                            blueprint_sections,
                            inferred_sections,
                            default_5_mcq=default_5_mcq,
                        ):
                            blueprint_sections = inferred_sections
                    stage_timings["topic_detection"] = _log_stage_timing(
                        job_id,
                        quiz_id,
                        "topic_detection",
                        topic_detection_started_at,
                    )

                counts_needed = sum(section["number_of_questions"] for section in blueprint_sections)

                from_source = pick_from_source(source_questions, blueprint_sections)
                pending_source_completion = strict_source_alignment and len(from_source) < counts_needed
                if from_source and len(from_source) < counts_needed:
                    last_feedback = f"Source parsing filled {len(from_source)}/{counts_needed}. Filling remaining from AI."
                elif not from_source and strict_source_alignment:
                    last_feedback = "Strict source alignment is ON, but no parseable questions were found in source text."

                question_generation_started_at = time.perf_counter()
                await _set_job_stage(job, db, stage="question_generation", progress=35, timings=stage_timings)

                if from_source and len(from_source) == counts_needed:
                    selected_pairs = from_source
                else:
                    for attempt in range(2):
                        if selected_pairs:
                            break

                        llm_generated_started_at = time.perf_counter()
                        cleaned_questions = sanitize_generated_questions(
                            await generate_quiz_questions_batched(
                                extracted_text=extracted_text,
                                blueprint_sections=blueprint_sections,
                                professor_note=retry_note,
                                source_questions=source_questions,
                                retry_feedback=last_feedback,
                            )
                        )
                        stage_timings[f"question_generation_attempt_{attempt + 1}"] = _log_stage_timing(
                            job_id,
                            quiz_id,
                            f"question_generation_attempt_{attempt + 1}",
                            llm_generated_started_at,
                        )

                        if pending_source_completion:
                            from_source = pick_from_source(source_questions, blueprint_sections)
                            pending_source_completion = len(from_source) < counts_needed

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

                        break

                stage_timings["question_generation"] = _log_stage_timing(
                    job_id,
                    quiz_id,
                    "question_generation",
                    question_generation_started_at,
                )
                await _set_job_stage(job, db, stage="question_generation", progress=60, timings=stage_timings)

                if not selected_pairs:
                    if strict_source_alignment:
                        raise ValueError(
                            last_feedback or "Strict source alignment is ON and source questions did not fully satisfy blueprint."
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

                db_persist_started_at = time.perf_counter()
                await db.execute(delete(Question).where(Question.quiz_id == quiz.id))
                db_sections = await ensure_quiz_sections(db, quiz, blueprint_sections)

                order_cursor: dict[int, int] = {}
                question_rows: list[dict] = []
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
                    next_order_index = order_cursor.get(section_index, 0) + 1
                    order_cursor[section_index] = next_order_index
                    question_rows.append(
                        {
                            "id": uuid.uuid4(),
                            "quiz_id": quiz.id,
                            "section_id": target_section.id,
                            "question_text": sanitized.question_text,
                            "question_type": target_type,
                            "options": options,
                            "correct_answer": correct_answer,
                            "marks": target_marks,
                            "status": "DRAFT",
                            "order_index": next_order_index,
                        }
                    )

                if question_rows:
                    await db.execute(insert(Question), question_rows)

                quiz.ai_generation_status = "GENERATED"
                job.status = "COMPLETED"
                stage_timings["db_write"] = _log_stage_timing(job_id, quiz_id, "db_write", db_persist_started_at)
                stage_timings["total"] = _log_stage_timing(job_id, quiz_id, "total", total_started_at)
                job.meta = {
                    **(job.meta or {}),
                    "generated_count": len(selected_pairs),
                    "stage": "difficulty_calibration",
                    "progress": 100,
                    "timings": {name: round(value, 3) for name, value in stage_timings.items()},
                }
                await db.commit()
                logger.info(f"[SUCCESS] Quiz generation completed: job_id={job_id}, questions={len(selected_pairs)}")

            except Exception as e:
                logger.error(f"[FAILED] Quiz generation failed: job_id={job_id}, error={e}")
                if quiz:
                    quiz.ai_generation_status = "FAILED"
                job.status = "FAILED"
                job.meta = {**(job.meta or {}), "error": str(e)}
                await db.commit()
                raise

    try:
        asyncio.run(_run())
    except Exception as e:
        logger.error(f"[FAILED] Fatal error in quiz generation: job_id={job_id}, error={e}")
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

