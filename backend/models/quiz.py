import uuid
from sqlalchemy import String, Boolean, ForeignKey, JSON, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from backend.core.database import Base
from backend.models.base import UUIDMixin, TimestampMixin


class Quiz(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "quizzes"

    title: Mapped[str] = mapped_column(String(255))

    description: Mapped[str | None] = mapped_column(
        String,
        nullable=True
    )

    academic_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )
    # Allowed values: "college" | "school"
    ai_generation_status: Mapped[str] = mapped_column(
        String(50),
        default="NOT_STARTED",
        nullable=False,
    )
    # Allowed values:
    # "NOT_STARTED" | "PROCESSING" | "GENERATED" | "APPROVED"

    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id")
    )

    is_published: Mapped[bool] = mapped_column(
        Boolean,
        default=False
    )
    is_archived: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    public_slug: Mapped[str | None] = mapped_column(
        String(64),
        unique=True,
        nullable=True,
    )
    duration_minutes: Mapped[int] = mapped_column(
        default=60,
        nullable=False,
    )

    # Legacy JSON settings column (kept for backward compatibility with existing schema).
    settings_json: Mapped[dict] = mapped_column(
        "settings",
        JSON,
        nullable=False,
        default=dict,
        server_default=text("'{}'"),
    )

    sections = relationship(
        "QuizSection",
        back_populates="quiz",
        cascade="all,delete"
    )
    settings = relationship(
        "QuizSettings",
        back_populates="quiz",
        cascade="all,delete-orphan",
    )
