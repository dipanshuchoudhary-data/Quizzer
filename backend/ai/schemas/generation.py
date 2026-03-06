from typing import List, Optional

from pydantic import BaseModel, field_validator

class GeneratedQuestion(BaseModel):
    question_text: str
    question_type: str
    options: Optional[list[str]] = None
    correct_answer: Optional[str] = None
    marks: int = 1

    @field_validator("marks", mode="before")
    @classmethod
    def normalize_marks(cls, value):
        if value is None:
            return 1
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            return 1
        return parsed if parsed > 0 else 1


class QuizGenerationOutput(BaseModel):
    questions: List[GeneratedQuestion]
