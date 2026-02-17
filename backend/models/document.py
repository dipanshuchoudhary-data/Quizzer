import uuid
from sqlalchemy import String, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from backend.core.database import Base
from backend.models.base import UUIDMixin, TimestampMixin


class Document(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "documents"

    quiz_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("quizzes.id", ondelete="CASCADE"),
    )

    file_name: Mapped[str] = mapped_column(String(255))
    file_type: Mapped[str] = mapped_column(String(50))  
    # pdf | docx | pptx | image | scanned_pdf

    storage_path: Mapped[str] = mapped_column(String(500))

    extraction_status: Mapped[str] = mapped_column(String(100), default="PENDING")
    # PENDING | PROCESSING | COMPLETED | FAILED

    extracted_metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)
