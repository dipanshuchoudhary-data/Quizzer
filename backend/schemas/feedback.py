from pydantic import BaseModel, Field, field_validator


def _count_words(value: str) -> int:
    return len([word for word in value.strip().split() if word])


class FeedbackCreateRequest(BaseModel):
    message: str = Field(..., min_length=1)

    @field_validator("message")
    @classmethod
    def validate_message(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Feedback is required")
        if _count_words(cleaned) > 500:
            raise ValueError("Feedback must be 500 words or fewer")
        return cleaned
