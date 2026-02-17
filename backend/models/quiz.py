import uuid
from sqlalchemy import String, Boolean, ForeignKey
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

    sections = relationship(
        "QuizSection",
        back_populates="quiz",
        cascade="all,delete"
    )
