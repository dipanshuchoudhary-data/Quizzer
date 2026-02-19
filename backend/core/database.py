from sqlalchemy.ext.asyncio import (
    create_async_engine,
    async_sessionmaker,
    AsyncSession,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import MetaData

from backend.core.config import settings


# --------------------------------------------------
# Naming Convention (Important for Alembic)
# --------------------------------------------------

naming_convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

metadata = MetaData(naming_convention=naming_convention)


# --------------------------------------------------
# Base Class
# --------------------------------------------------

class Base(DeclarativeBase):
    metadata = metadata


# --------------------------------------------------
# Engine
# --------------------------------------------------

engine = create_async_engine(
    settings.POSTGRES_DSN,
    pool_pre_ping=True,
    echo=False,
)


# --------------------------------------------------
# Session Factory
# --------------------------------------------------

SessionLocal = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


# --------------------------------------------------
# FastAPI Dependency
# --------------------------------------------------

async def get_db() -> AsyncSession:
    async with SessionLocal() as session:
        yield session
