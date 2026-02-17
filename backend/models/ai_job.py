import uuid
from sqlalchemy import String, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from backend.core.database import Base
from backend.models.base import UUIDMixin, TimestampMixin


class AIJob(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "ai_jobs"

    quiz_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("quizzes.id", ondelete="CASCADE"),
    )

    job_type: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(100))

    # ✅ Python attribute renamed, DB column still called "metadata"
    meta: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)
