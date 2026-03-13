from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Any


class StartAttemptRequest(BaseModel):
    student_name: str
    enrollment_number: str
    institution_type: str

    course: str
    section: str
    batch: str
    semester: str
    class_name: str | None = None
    class_section: str | None = None


class StartPublicAttemptRequest(BaseModel):
    public_exam_id: str
    student_name: str
    enrollment_number: str
    institution_type: str
    course: str
    section: str
    batch: str
    semester: str


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
    duration: int
    questions: list[AttemptQuestionSnapshot]
    academic_type: str
    quiz_title: str
    start_time: datetime
    end_time: datetime


class SubmitAttemptResponse(BaseModel):
    message: str
    submitted_at: datetime
