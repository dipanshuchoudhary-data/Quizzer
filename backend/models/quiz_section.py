import uuid
from sqlalchemy import String, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from backend.core.database import Base
from backend.models.base import UUIDMixin, TimestampMixin


class QuizSection(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "quiz_sections"

    quiz_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("quizzes.id", ondelete="CASCADE"),
    )

    title: Mapped[str] = mapped_column(String(255))
    total_marks: Mapped[int] = mapped_column(Integer)

    quiz = relationship("Quiz", back_populates="sections")
    questions = relationship("Question", cascade="all, delete")
