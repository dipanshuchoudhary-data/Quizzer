from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.core.database import Base
from backend.models.base import UUIDMixin, TimestampMixin


class User(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "users"

    full_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        default="Professor",
    )

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )

    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    is_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    email_verification_token_hash: Mapped[str | None] = mapped_column(
        String(128),
        nullable=True,
    )

    email_verification_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Role-based authorization (PRIMARY PERMISSION FIELD)
    role: Mapped[str] = mapped_column(
        String(50),
        default="ADMIN",   # change to "USER" if needed
        nullable=False,
    )

    # Optional — keep only if legacy logic depends on it
    is_staff: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    phone_number: Mapped[str | None] = mapped_column(
        String(20),
        unique=True,
        index=True,
        nullable=True,
    )

    institution: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    country: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True,
    )

    timezone: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True,
    )

    subject_area: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    courses_taught: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    teaching_experience: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True,
    )

    avatar_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    onboarding_completed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
