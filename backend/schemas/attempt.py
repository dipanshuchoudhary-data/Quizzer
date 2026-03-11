from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Any


class StartAttemptRequest(BaseModel):
    student_name: str
    enrollment_number: str

    # College fields
    course: str | None = None
    section: str | None = None
    batch: str | None = None
    semester: str | None = None

    # School fields
    class_name: str | None = None
    class_section: str | None = None


class AttemptQuestionSnapshot(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    question_text: str
    question_type: str
    options: dict[str, Any] | list[str] | None = None
    marks: int


class StartAttemptResponse(BaseModel):
    attempt_id: UUID
    attempt_token: str
    duration_seconds: int
    questions: list[AttemptQuestionSnapshot]
    academic_type: str
    quiz_title: str


class SubmitAttemptResponse(BaseModel):
    message: str
    submitted_at: datetime
