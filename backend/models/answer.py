import uuid
from sqlalchemy import ForeignKey,String
from sqlalchemy.orm import Mapped,mapped_column
from sqlalchemy.dialects.postgresql import UUID
from backend.core.database import Base
from backend.models.base import UUIDMixin,TimestampMixin

class Answer(Base,UUIDMixin,TimestampMixin):
    __tablename__="answers"

    attempt_id:Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("attempts.id",ondelete="CASCADE"),
    )

    question_id:Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("questions.id",ondelete="CASCADE"),
    )

    answer_text:Mapped[str] = mapped_column(String)


