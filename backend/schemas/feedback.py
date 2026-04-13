from pydantic import BaseModel, Field, field_validator


def _count_words(value: str) -> int:
    return len([word for word in value.strip().split() if word])


class FeedbackCreateRequest(BaseModel):
    message: str = Field(..., min_length=1)
    subject: str | None = Field(default=None, max_length=160)
    contact_email: str | None = Field(default=None, max_length=254)

    @field_validator("message")
    @classmethod
    def validate_message(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Feedback is required")
        if _count_words(cleaned) > 500:
            raise ValueError("Feedback must be 500 words or fewer")
        return cleaned

    @field_validator("subject")
    @classmethod
    def validate_subject(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("contact_email")
    @classmethod
    def validate_contact_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip().lower()
        if not cleaned:
            return None
        if "@" not in cleaned or "." not in cleaned.rsplit("@", 1)[-1]:
            raise ValueError("A valid contact email is required")
        return cleaned
