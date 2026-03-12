import uuid
from datetime import datetime
from sqlalchemy import String, ForeignKey, DateTime, Integer, UniqueConstraint, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from backend.core.database import Base
from backend.models.base import UUIDMixin, TimestampMixin


class Attempt(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "attempts"
    __table_args__ = (
        UniqueConstraint("quiz_id", "enrollment_number", name="uq_attempts_quiz_enrollment_number"),
    )

    quiz_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("quizzes.id", ondelete="CASCADE"),
        nullable=False,
    )

    attempt_token: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )
    enrollment_number: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="IN_PROGRESS",
    )
    final_score: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    questions_snapshot: Mapped[list | None] = mapped_column(
        JSON,
        nullable=True,
    )

    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # relationships
    profile = relationship(
        "StudentProfile",
        back_populates="attempt",
        uselist=False,
        cascade="all, delete",
    )
