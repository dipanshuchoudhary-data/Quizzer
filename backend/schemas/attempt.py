from pydantic import BaseModel
from uuid import UUID
from datetime import datetime


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


class StartAttemptResponse(BaseModel):
    attempt_id: UUID
    attempt_token: str
    duration_seconds: int


class SubmitAttemptResponse(BaseModel):
    message: str
    submitted_at: datetime
