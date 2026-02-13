import uuid
from sqlalchemy import String,Boolean,ForeignKey
from sqlalchemy.orm import Mapped,mapped_column,relationship
from backend.core.database import Base
from backend.models.base import UUIDMixin,TimestampMixin
from sqlalchemy.dialects.postgresql import UUID

class Quiz(Base,UUIDMixin,TimestampMixin):
    __tablename__ = "quizzes"

    title:Mapped[str] = mapped_column(String(255))
    description:Mapped[str | None] = mapped_column(String,nullable=True)

    created_by:Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id")
    ) 

    is_published:Mapped[bool] = mapped_column(Boolean,default=False)
    sections=relationship("QuizSection",back_populates="quiz",cascade="all,delete")


