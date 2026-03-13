import asyncio
import sys

from sqlalchemy.ext.asyncio import (
    create_async_engine,
    async_sessionmaker,
    AsyncSession,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import MetaData

from backend.core.config import settings

# psycopg async mode is incompatible with ProactorEventLoop on Windows.
# Ensure selector policy is active before SQLAlchemy creates connections.
if sys.platform.startswith("win"):
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


def _resolve_async_dsn(raw_dsn: str) -> str:
    # psycopg async can fail on Windows event-loop variants in some launch paths.
    # Force asyncpg driver for runtime async engine to keep behavior stable.
    if sys.platform.startswith("win") and raw_dsn.startswith("postgresql+psycopg://"):
        return raw_dsn.replace("postgresql+psycopg://", "postgresql+asyncpg://", 1)
    return raw_dsn


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
    _resolve_async_dsn(settings.POSTGRES_DSN),
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
