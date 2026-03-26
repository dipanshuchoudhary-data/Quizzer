from backend.services.question_quality import normalize_math_text, sanitize_question_candidate
from backend.workers.quiz_creation_task import (
    parse_questions_from_source,
    should_replace_blueprint_with_inferred_sections,
)


def test_normalize_math_text_collapses_ocr_duplicates():
    assert normalize_math_text("θ\\thetaθ") == "\\theta"
    assert normalize_math_text("usinθ u\\sin\\thetausinθ") == "u \\sin\\theta"
    assert normalize_math_text("ucosθ u\\cos\\thetaucosθ") == "u \\cos\\theta"


def test_sanitize_question_candidate_discards_question_text_in_options_and_deduplicates_math():
    sanitized = sanitize_question_candidate(
        question_text="A projectile is launched with velocity uuu at an angle θ\\thetaθ with the horizontal. The horizontal component of velocity is:",
        question_type="MCQ",
        options=[
            "A projectile is launched with velocity uuu at an angle θ\\thetaθ with the horizontal. The horizontal component of velocity is:",
            "usinθ u\\sin\\thetausinθ",
            "ucosθ u\\cos\\thetaucosθ",
            "utanθ u\\tan\\thetautanθ",
            "ucotθ u\\cot\\thetaucotθ",
        ],
        correct_answer="ucosθ u\\cos\\thetaucosθ",
        marks=1,
    )

    assert sanitized is not None
    assert sanitized.question_text == (
        "A projectile is launched with velocity uuu at an angle \\theta with the horizontal."
        " The horizontal component of velocity is:"
    )
    assert sanitized.options == [
        "u \\sin\\theta",
        "u \\cos\\theta",
        "u \\tan\\theta",
        "u \\cot\\theta",
    ]
    assert sanitized.correct_answer == "u \\cos\\theta"


def test_parse_questions_from_source_keeps_question_stem_out_of_options():
    extracted_text = """
1. A projectile is launched with velocity u at an angle θ\\thetaθ with the horizontal.
The horizontal component of velocity is:
(A) usinθ u\\sin\\thetausinθ
(B) ucosθ u\\cos\\thetaucosθ
(C) utanθ u\\tan\\thetautanθ
(D) ucotθ u\\cot\\thetaucotθ
Answer: B
"""

    parsed = parse_questions_from_source(extracted_text)

    assert len(parsed) == 1
    question = parsed[0]
    assert question.question_text == (
        "A projectile is launched with velocity u at an angle \\theta with the horizontal."
        " The horizontal component of velocity is:"
    )
    assert question.options == [
        "u \\sin\\theta",
        "u \\cos\\theta",
        "u \\tan\\theta",
        "u \\cot\\theta",
    ]
    assert question.correct_answer == "u \\cos\\theta"


def test_auto_detect_structure_does_not_expand_requested_question_count():
    requested_sections = [
        {
            "index": 0,
            "title": "Section 1",
            "number_of_questions": 20,
            "question_type": "MCQ",
            "marks_per_question": 1,
        }
    ]
    inferred_sections = [
        {
            "index": 0,
            "title": "MCQ",
            "number_of_questions": 46,
            "question_type": "MCQ",
            "marks_per_question": 1,
        }
    ]

    assert should_replace_blueprint_with_inferred_sections(
        requested_sections,
        inferred_sections,
        default_5_mcq=False,
    ) is False


def test_auto_detect_structure_can_replace_placeholder_blueprint():
    requested_sections = [
        {
            "index": 0,
            "title": "Section 1",
            "number_of_questions": 5,
            "question_type": "MCQ",
            "marks_per_question": 1,
        }
    ]
    inferred_sections = [
        {
            "index": 0,
            "title": "MCQ",
            "number_of_questions": 18,
            "question_type": "MCQ",
            "marks_per_question": 1,
        }
    ]

    assert should_replace_blueprint_with_inferred_sections(
        requested_sections,
        inferred_sections,
        default_5_mcq=True,
    ) is True
