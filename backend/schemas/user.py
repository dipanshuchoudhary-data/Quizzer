from pydantic import BaseModel, EmailStr, Field


class UserProfileUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=255)
    display_name: str | None = Field(default=None, min_length=2, max_length=255)
    email: EmailStr | None = None
    phone_number: str | None = Field(default=None, min_length=8, max_length=20)
    institution: str | None = None
    country: str | None = None
    timezone: str | None = None
    subject_area: str | None = None
    courses_taught: str | None = None
    teaching_experience: str | None = None
    avatar_url: str | None = None
    onboarding_completed: bool | None = None


class UserRoleUpdateRequest(BaseModel):
    role: str = Field(..., min_length=1)
