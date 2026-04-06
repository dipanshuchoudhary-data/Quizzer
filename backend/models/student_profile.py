import uuid
from sqlalchemy import String, ForeignKey, JSON, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from backend.core.database import Base
from backend.models.base import UUIDMixin, TimestampMixin


class StudentProfile(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "student_profiles"

    attempt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("attempts.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    student_name: Mapped[str] = mapped_column(String(255), nullable=False)
    enrollment_number: Mapped[str] = mapped_column(String(100), nullable=False)
    institution_type: Mapped[str] = mapped_column(String(20), nullable=False, default="college")
    verification_context: Mapped[str] = mapped_column(String(50), nullable=False, default="college")
    verification_data: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        default=dict,
        server_default=text("'{}'"),
    )

    # College fields
    course: Mapped[str | None] = mapped_column(String(255), nullable=True)
    section: Mapped[str | None] = mapped_column(String(50), nullable=True)
    batch: Mapped[str | None] = mapped_column(String(20), nullable=True)
    semester: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # School fields
    class_name: Mapped[str | None] = mapped_column(String(50), nullable=True)
    class_section: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # relationship
    attempt = relationship("Attempt", back_populates="profile")
