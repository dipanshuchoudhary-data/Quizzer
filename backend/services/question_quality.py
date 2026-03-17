import re
from types import SimpleNamespace
from typing import Any


ANSWER_DUMP_MARKERS = re.compile(
    r"(?im)\b(?:mcq\s*answers?|true\s*/?\s*false|short\s*answers?|long\s*answers?|answer\s*key|key\s*points?)\s*:"
)
INLINE_ANSWER_MARKER = re.compile(r"(?im)\b(?:answer|ans|correct\s*answer|correct\s*option)\s*[:\-]")
QUESTION_NUMBER_PREFIX = re.compile(r"(?im)^(?:q(?:uestion)?\s*\d+\s*[\).:-]?|[0-9]{1,3}\s*[\).:-])\s*")
OPTION_PREFIX = re.compile(r"^\s*(?:[\(\[]?(?:[a-h]|[1-8]|true|false)[\)\].:-]|[1-8]\.)\s*", re.IGNORECASE)
MARKS_SUFFIX = re.compile(r"(?i)\s*(?:\(|\[)?\s*[0-9]{1,2}\s*marks?\s*(?:\)|\])?\s*$")
OPTION_BLOCK_START = re.compile(r"(?im)^\s*(?:[\(\[]?\s*(?:[a-h]|[1-8])\s*[\)\].:-]|[1-8]\.)\s+")
INLINE_OPTION_SPLIT = re.compile(r"(?is)\s[\(\[]?\s*a\s*[\)\].:-]\s*")
LATEX_COMMANDS = (
    "alpha", "beta", "gamma", "delta", "theta", "lambda", "mu", "pi", "sigma", "phi", "omega",
    "sin", "cos", "tan", "cot", "sec", "csc", "log", "ln", "sqrt", "frac",
)
RAW_MATH_TOKEN_MAP = {
    "\u03b8": r"\theta",
    "\u03b1": r"\alpha",
    "\u03b2": r"\beta",
    "\u03b3": r"\gamma",
    "\u0394": r"\Delta",
    "\u03b4": r"\delta",
    "\u03bb": r"\lambda",
    "\u03bc": r"\mu",
    "\u03c0": r"\pi",
    "\u03c3": r"\sigma",
    "\u03c6": r"\phi",
    "\u03c9": r"\omega",
}


def normalize_question_type(value: str | None) -> str:
    token = str(value or "").strip().upper().replace("-", "_").replace(" ", "_").replace("/", "_")
    if token in {"TRUEFALSE", "TRUE_FALSE", "TRUE_FLASE", "TURE_FALSE", "BOOLEAN", "TF"}:
        return "TRUE_FALSE"
    if token in {"SHORTANSWER", "SHORT_ANSWER", "SHORTANS", "SA"}:
        return "SHORT_ANSWER"
    if token in {"LONGANSWER", "LONG_ANSWER", "LA"}:
        return "LONG_ANSWER"
    if token in {"DESCRIPTIVE", "DESCRIPTIVE_ANSWER"}:
        return "DESCRIPTIVE"
    if token in {"FILL_BLANK", "FILL_IN_THE_BLANK", "FILL_IN_BLANK"}:
        return "FILL_BLANK"
    if token in {"NUMERICAL", "NUMERIC", "NUMERICAL_ANSWER"}:
        return "NUMERICAL"
    if token in {"ASSERTION_REASONING", "ASSERTION_REASON", "ASSERTION_REASONING_Q"}:
        return "ASSERTION_REASONING"
    if token in {"CASE_BASED", "CASE_STUDY", "CASE"}:
        return "CASE_BASED"
    return "MCQ"


def map_marks_to_question_type(marks: int, fallback: str = "MCQ") -> str:
    if marks >= 6:
        return "LONG_ANSWER"
    if 3 <= marks <= 5:
        return "DESCRIPTIVE"
    if marks == 2:
        return "SHORT_ANSWER"
    if marks <= 1:
        return fallback
    return fallback


def _normalize_text(text: Any) -> str:
    value = str(text or "")
    value = value.replace("\r\n", "\n").replace("\r", "\n")
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def _collapse_repeated_compact_text(value: str) -> str:
    compact = re.sub(r"\s+", "", value)
    if len(compact) < 2:
        return value
    for size in range(min(len(compact) // 2, 32), 0, -1):
        if len(compact) % size != 0:
            continue
        chunk = compact[:size]
        repeats = len(compact) // size
        if repeats >= 2 and chunk * repeats == compact:
            return chunk
    return value


def normalize_math_text(text: Any) -> str:
    value = _normalize_text(text)
    if not value:
        return ""

    for raw, latex in RAW_MATH_TOKEN_MAP.items():
        value = value.replace(raw, latex)

    value = re.sub(r"\\([A-Za-z]+)", lambda match: f"\\{match.group(1).lower()}", value)
    value = re.sub(
        r"(?<!\\)\b(?:sin|cos|tan|cot|sec|csc|log|ln|sqrt|frac|theta|alpha|beta|gamma|delta|lambda|mu|pi|sigma|phi|omega)\b",
        lambda match: f"\\{match.group(0).lower()}",
        value,
    )

    for token in LATEX_COMMANDS:
        value = re.sub(rf"(?i){token}\s*\\{token}\s*{token}", rf"\\{token}", value)
        value = re.sub(rf"(?i){token}\s*\\{token}", rf"\\{token}", value)
        value = re.sub(rf"(?i)\\{token}\s*{token}", rf"\\{token}", value)

    for token in ("sin", "cos", "tan", "cot"):
        value = re.sub(
            rf"(?i)\bu\s*{token}\s*\\theta\s*u?\s*\\{token}\s*\\theta\s*u?\s*{token}\s*\\theta\b",
            rf"u \\{token}\\theta",
            value,
        )
        value = re.sub(
            rf"(?i)\bu\s*{token}\s*\\theta\s*u?\s*\\{token}\s*\\theta\b",
            rf"u \\{token}\\theta",
            value,
        )
        value = re.sub(
            rf"(?i)\bu\s*\\{token}\s*\\theta\s*u?\s*{token}\s*\\theta\b",
            rf"u \\{token}\\theta",
            value,
        )

    compact_candidate = re.sub(r"\s+", "", value)
    collapsed = _collapse_repeated_compact_text(compact_candidate)
    if collapsed != compact_candidate and len(compact_candidate) <= 48:
        value = collapsed

    value = re.sub(r"(\\[A-Za-z]+)(?:\1)+", r"\1", value)
    value = re.sub(r"([A-Za-z0-9])\\([A-Za-z]+)", r"\1 \\\2", value)
    value = re.sub(r"\\(sin|cos|tan|cot|sec|csc|log|ln)\s+\\theta", r"\\\1\\theta", value)
    value = re.sub(r"(?<!\\)\b([A-Za-z])(?=\\[A-Za-z]+)", r"\1 ", value)
    value = re.sub(r"\s*([+\-=/,:;()])\s*", r"\1", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def wrap_latex_fragments(text: Any) -> str:
    value = normalize_math_text(text)
    if not value:
        return ""
    return re.sub(r"(\\[A-Za-z]+(?:\{[^{}]*\}|[A-Za-z0-9])*)", r"$\1$", value)


def _clean_question_text(text: Any) -> str:
    value = normalize_math_text(text)
    if not value:
        return ""

    value = QUESTION_NUMBER_PREFIX.sub("", value, count=1)
    value = ANSWER_DUMP_MARKERS.split(value, maxsplit=1)[0].strip()
    value = INLINE_ANSWER_MARKER.split(value, maxsplit=1)[0].strip()
    value = OPTION_BLOCK_START.split(value, maxsplit=1)[0].strip()
    value = INLINE_OPTION_SPLIT.split(value, maxsplit=1)[0].strip()
    value = re.sub(r"(?i)(\?\s*)[a-h]$", r"\1", value).strip()
    value = re.sub(r"(?i)(marks?\)?)([a-h])$", r"\1", value).strip()
    return value


def _clean_option(option: Any) -> str:
    value = normalize_math_text(option)
    value = OPTION_PREFIX.sub("", value)
    value = MARKS_SUFFIX.sub("", value).strip(" .;:-")
    return value.strip()


def _canonical_text_key(value: str) -> str:
    return re.sub(r"\s+", " ", value.casefold()).strip(" .;:-")


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
        key = _canonical_text_key(option)
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(option)
    return cleaned


def _normalize_tf_answer(answer: Any) -> str:
    token = _normalize_text(answer).strip("()[] .;:-").lower()
    if token in {"true", "t", "1"}:
        return "True"
    if token in {"false", "f", "0"}:
        return "False"
    return "answer_unavailable"


def _map_mcq_answer(answer: Any, options: list[str]) -> str:
    cleaned = normalize_math_text(answer).strip()
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

    normalized_cleaned = _canonical_text_key(cleaned)
    for option in options:
        if _canonical_text_key(option) == normalized_cleaned:
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

    if normalized_marks >= 2 and normalized_type in {"MCQ", "TRUE_FALSE"}:
        normalized_type = map_marks_to_question_type(normalized_marks, fallback=normalized_type)
    if normalized_type in {"MCQ", "SHORT_ANSWER", "LONG_ANSWER", "DESCRIPTIVE"} and question_type in {None, "", "AUTO"}:
        normalized_type = map_marks_to_question_type(normalized_marks, fallback=normalized_type)

    normalized_options = _normalize_options(options)
    normalized_answer: str | None = None

    if normalized_type == "TRUE_FALSE":
        normalized_options = ["True", "False"]
        normalized_answer = _normalize_tf_answer(correct_answer)
    elif normalized_type in {"MCQ", "ASSERTION_REASONING", "CASE_BASED"}:
        question_key = _canonical_text_key(cleaned_text)
        normalized_options = [
            option for option in normalized_options
            if _canonical_text_key(option) != question_key
        ]
        if len(normalized_options) != 4:
            return None
        if len({_canonical_text_key(option) for option in normalized_options}) != 4:
            return None
        normalized_answer = _map_mcq_answer(correct_answer, normalized_options)
    elif normalized_type in {"FILL_BLANK", "NUMERICAL"}:
        normalized_options = []
        normalized_answer = _normalize_text(correct_answer)
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
