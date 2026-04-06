from pydantic import BaseModel, ConfigDict, Field, model_validator
from uuid import UUID
from datetime import datetime
from typing import Any

from backend.services.verification import VerificationSchema


class StartAttemptRequest(BaseModel):
    verification_context: str | None = None
    verification_data: dict[str, Any] = Field(default_factory=dict)

    student_name: str | None = None
    enrollment_number: str | None = None
    institution_type: str | None = None
    course: str | None = None
    section: str | None = None
    batch: str | None = None
    semester: str | None = None
    class_name: str | None = None
    class_section: str | None = None

    @model_validator(mode="after")
    def _lift_legacy_payload(self):
        if self.verification_data:
            return self

        legacy = {
            "student_name": self.student_name,
            "enrollment_number": self.enrollment_number,
            "course": self.course,
            "section": self.section,
            "batch": self.batch,
            "semester": self.semester,
            "class_name": self.class_name,
            "class_section": self.class_section,
        }
        self.verification_data = {key: value for key, value in legacy.items() if isinstance(value, str) and value.strip()}
        self.verification_context = self.verification_context or self.institution_type
        return self


class StartPublicAttemptRequest(BaseModel):
    public_exam_id: str
    verification_context: str | None = None
    verification_data: dict[str, Any] = Field(default_factory=dict)

    student_name: str | None = None
    enrollment_number: str | None = None
    institution_type: str | None = None
    course: str | None = None
    section: str | None = None
    batch: str | None = None
    semester: str | None = None

    @model_validator(mode="after")
    def _lift_legacy_payload(self):
        if self.verification_data:
            return self

        legacy = {
            "student_name": self.student_name,
            "enrollment_number": self.enrollment_number,
            "course": self.course,
            "section": self.section,
            "batch": self.batch,
            "semester": self.semester,
        }
        self.verification_data = {key: value for key, value in legacy.items() if isinstance(value, str) and value.strip()}
        self.verification_context = self.verification_context or self.institution_type
        return self


class ExamEntryConfigResponse(BaseModel):
    quiz_id: UUID
    quiz_title: str
    academic_type: str
    require_fullscreen: bool
    violation_limit: int
    verification: VerificationSchema


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
