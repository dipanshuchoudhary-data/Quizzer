from sqlalchemy import String, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from backend.core.database import Base
from backend.models.base import UUIDMixin, TimestampMixin


class User(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )

    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    # Role-based authorization (PRIMARY PERMISSION FIELD)
    role: Mapped[str] = mapped_column(
        String(50),
        default="ADMIN",   # change to "USER" if needed
        nullable=False,
    )

    # Optional — keep only if legacy logic depends on it
    is_staff: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )