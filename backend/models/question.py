import uuid
from sqlalchemy import String, Integer, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from backend.core.database import Base
from backend.models.base import UUIDMixin, TimestampMixin

class Question(Base,UUIDMixin,TimestampMixin):
    __tablename__ = "questions"

    section_id:Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("quiz_sections.id",ondelete="CASCADE"),
    )

    question_type : Mapped[str] = mapped_column(String)
    question_type:Mapped[str] = mapped_column(String(50))

    options:Mapped[dict| None] = mapped_column(JSON,nullable=True)
    correct_answer:Mapped[str | None] = mapped_column(String,nullable=True)
    marks:Mapped[int] = mapped_column(Integer)