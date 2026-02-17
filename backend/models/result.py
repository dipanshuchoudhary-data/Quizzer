import uuid
from sqlalchemy import Integer, Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from backend.core.database import Base
from backend.models.base import UUIDMixin, TimestampMixin


class Result(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "results"

    attempt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("attempts.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    final_score: Mapped[int] = mapped_column(Integer, nullable=False)

    violation_count: Mapped[int] = mapped_column(Integer, default=0)

    integrity_flag: Mapped[bool] = mapped_column(Boolean, default=False)

    status: Mapped[str] = mapped_column(String(100), nullable=False)
    
