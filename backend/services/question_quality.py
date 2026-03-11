import re
from types import SimpleNamespace
from typing import Any


ANSWER_DUMP_MARKERS = re.compile(
    r"(?im)\b(?:mcq\s*answers?|true\s*/?\s*false|short\s*answers?|long\s*answers?|answer\s*key|key\s*points?)\s*:"
)
INLINE_ANSWER_MARKER = re.compile(r"(?im)\b(?:answer|ans|correct\s*answer|correct\s*option)\s*[:\-]")
QUESTION_NUMBER_PREFIX = re.compile(r"(?im)^(?:q(?:uestion)?\s*\d+\s*[\).:-]?|[0-9]{1,3}\s*[\).:-])\s*")
OPTION_PREFIX = re.compile(r"^\s*[\(\[]?(?:[a-h]|[1-8]|true|false)[\)\].:-]\s*", re.IGNORECASE)
MARKS_SUFFIX = re.compile(r"(?i)\s*(?:\(|\[)?\s*[0-9]{1,2}\s*marks?\s*(?:\)|\])?\s*$")


def normalize_question_type(value: str | None) -> str:
    token = str(value or "").strip().upper().replace("-", "_").replace(" ", "_").replace("/", "_")
    if token in {"TRUEFALSE", "TRUE_FALSE", "TRUE_FLASE", "TURE_FALSE", "BOOLEAN", "TF"}:
        return "TRUE_FALSE"
    if token in {"SHORTANSWER", "SHORT_ANSWER", "SHORTANS", "SA"}:
        return "SHORT_ANSWER"
    if token in {"LONGANSWER", "LONG_ANSWER", "LA"}:
        return "LONG_ANSWER"
    return "MCQ"


def _normalize_text(text: Any) -> str:
    value = str(text or "")
    value = value.replace("\r\n", "\n").replace("\r", "\n")
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def _clean_question_text(text: Any) -> str:
    value = _normalize_text(text)
    if not value:
        return ""

    value = QUESTION_NUMBER_PREFIX.sub("", value, count=1)
    value = ANSWER_DUMP_MARKERS.split(value, maxsplit=1)[0].strip()
    value = INLINE_ANSWER_MARKER.split(value, maxsplit=1)[0].strip()
    value = re.split(r"(?im)\n\s*(?:[a-h]|[1-8]|true|false)\s*[\).:-]\s*", value, maxsplit=1)[0].strip()
    value = re.split(r"(?is)\s[\(\[]?\s*a\s*[\)\].:-]\s*", value, maxsplit=1)[0].strip()
    value = re.sub(r"(?i)(\?\s*)[a-h]$", r"\1", value).strip()
    value = re.sub(r"(?i)(marks?\)?)([a-h])$", r"\1", value).strip()
    return value


def _clean_option(option: Any) -> str:
    value = _normalize_text(option)
    value = OPTION_PREFIX.sub("", value)
    value = MARKS_SUFFIX.sub("", value).strip(" .;:-")
    return value.strip()


def _normalize_options(options: Any) -> list[str]:
    if options is None:
        return []
    raw_options = options if isinstance(options, list) else list(options.values()) if isinstance(options, dict) else [options]
    cleaned: list[str] = []
    seen: set[str] = set()
    for item in raw_options:
        option = _clean_option(item)
        if not option:
            continue
        if ANSWER_DUMP_MARKERS.search(option) or INLINE_ANSWER_MARKER.search(option):
            continue
        key = option.casefold()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(option)
    return cleaned[:6]


def _normalize_tf_answer(answer: Any) -> str:
    token = _normalize_text(answer).strip("()[] .;:-").lower()
    if token in {"true", "t", "1"}:
        return "True"
    if token in {"false", "f", "0"}:
        return "False"
    return "answer_unavailable"


def _map_mcq_answer(answer: Any, options: list[str]) -> str:
    cleaned = _normalize_text(answer).strip()
    if not cleaned:
        return "answer_unavailable"

    lowered = cleaned.lower().strip("()[] .;:-")
    compact = re.sub(r"[^a-z0-9]", "", lowered)
    if compact in {"a", "b", "c", "d", "e", "f"}:
        idx = ord(compact) - ord("a")
        if 0 <= idx < len(options):
            return options[idx]
    if compact.isdigit():
        idx = int(compact) - 1
        if 0 <= idx < len(options):
            return options[idx]

    for option in options:
        if option.casefold() == cleaned.casefold():
            return option

    return "answer_unavailable"


def sanitize_question_candidate(
    *,
    question_text: Any,
    question_type: Any,
    options: Any = None,
    correct_answer: Any = None,
    marks: Any = None,
) -> SimpleNamespace | None:
    normalized_type = normalize_question_type(str(question_type or "MCQ"))
    cleaned_text = _clean_question_text(question_text)
    if len(cleaned_text) < 8:
        return None
    if ANSWER_DUMP_MARKERS.search(cleaned_text):
        return None

    normalized_marks = 1
    try:
        normalized_marks = max(1, int(marks or 1))
    except (TypeError, ValueError):
        normalized_marks = 1

    normalized_options = _normalize_options(options)
    normalized_answer: str | None = None

    if normalized_type == "TRUE_FALSE":
        normalized_options = ["True", "False"]
        normalized_answer = _normalize_tf_answer(correct_answer)
    elif normalized_type == "MCQ":
        if len(normalized_options) < 2:
            return None
        normalized_answer = _map_mcq_answer(correct_answer, normalized_options)
    else:
        normalized_options = []
        normalized_answer = None

    return SimpleNamespace(
        question_text=cleaned_text,
        question_type=normalized_type,
        options=normalized_options or None,
        correct_answer=normalized_answer,
        marks=normalized_marks,
    )
