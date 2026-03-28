import asyncio
from types import SimpleNamespace

from backend.ai.graphs.result_processing_graph import _build_short_answer_payload


def test_build_short_answer_payload_preserves_existing_answer_keys():
    snapshot = [
        {
            "id": "q1",
            "question_text": "Name one of the seven wonders of the world.",
            "question_type": "SHORT_ANSWER",
            "correct_answer": "Great Wall of China",
            "marks": 2,
        }
    ]

    payload, review_required = asyncio.run(
        _build_short_answer_payload(snapshot, {"q1": "Great Wall of China"})
    )

    assert review_required is False
    assert payload == [
        {
            "question_id": "q1",
            "question_text": "Name one of the seven wonders of the world.",
            "student_answer": "Great Wall of China",
            "correct_answer": "Great Wall of China",
            "max_marks": 2,
        }
    ]


def test_build_short_answer_payload_backfills_missing_answer_keys(monkeypatch):
    async def fake_generate_missing_answers(questions):
        return SimpleNamespace(
            questions=[
                SimpleNamespace(correct_answer="Rio de Janeiro")
                for _ in questions
            ]
        )

    monkeypatch.setattr(
        "backend.ai.graphs.result_processing_graph.generate_missing_answers",
        fake_generate_missing_answers,
    )

    snapshot = [
        {
            "id": "q2",
            "question_text": "What is the capital of the state of Rio de Janeiro?",
            "question_type": "SHORT_ANSWER",
            "correct_answer": None,
            "marks": 2,
        }
    ]

    payload, review_required = asyncio.run(
        _build_short_answer_payload(snapshot, {"q2": "Rio"})
    )

    assert review_required is False
    assert payload[0]["question_text"] == "What is the capital of the state of Rio de Janeiro?"
    assert payload[0]["student_answer"] == "Rio"
    assert payload[0]["correct_answer"] == "Rio de Janeiro"
    assert payload[0]["max_marks"] == 2
