import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.core.database import Base
from backend.models.base import UUIDMixin, TimestampMixin


class QuizSettings(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "quiz_settings"
    __table_args__ = (
        UniqueConstraint("quiz_id", "owner_user_id", name="uq_quiz_settings_quiz_id_owner_user_id"),
    )

    quiz_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("quizzes.id", ondelete="CASCADE"),
        nullable=False,
    )
    owner_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    duration: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    default_marks: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    shuffle_questions: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    shuffle_options: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    require_fullscreen: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    block_tab_switch: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    block_copy_paste: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    violation_limit: Mapped[int] = mapped_column(Integer, default=3, nullable=False)

    negative_marking: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    penalty_wrong: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    violation_penalty: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    attempts_allowed: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    allow_resume: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    prevent_duplicate: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    quiz = relationship("Quiz", back_populates="settings")
