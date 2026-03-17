import uuid
from sqlalchemy import String, Integer, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID

from backend.core.database import Base
from backend.models.base import UUIDMixin, TimestampMixin


class Question(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "questions"

    quiz_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("quizzes.id", ondelete="CASCADE"),
        nullable=False,
    )

    section_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("quiz_sections.id", ondelete="CASCADE"),
    )

    # 🔥 ADD THIS FIELD
    question_text: Mapped[str] = mapped_column(
        String,
        nullable=False,
    )

    # Question type (MCQ, SHORT_ANSWER, etc.)
    question_type: Mapped[str] = mapped_column(String(50))
    difficulty: Mapped[str | None] = mapped_column(String(20), nullable=True)

    status: Mapped[str] = mapped_column(
        String(50),
        default="DRAFT",
        nullable=False,
    )

    options: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True
    )

    correct_answer: Mapped[str | None] = mapped_column(
        String,
        nullable=True
    )

    marks: Mapped[int] = mapped_column(Integer)

    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
