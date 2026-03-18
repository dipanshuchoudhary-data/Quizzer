import sys
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool
from backend.core.config import settings


def _resolve_async_dsn(raw_dsn: str) -> str:
    if sys.platform.startswith("win") and raw_dsn.startswith("postgresql+psycopg://"):
        return raw_dsn.replace("postgresql+psycopg://", "postgresql+asyncpg://", 1)
    return raw_dsn


def get_task_sessionmaker() -> async_sessionmaker[AsyncSession]:
    # Ensure selector policy on Windows for asyncpg compatibility.
    if sys.platform.startswith("win"):
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    engine = create_async_engine(
        _resolve_async_dsn(settings.POSTGRES_DSN),
        pool_pre_ping=True,
        poolclass=NullPool,
        echo=False,
    )
    return async_sessionmaker(bind=engine, expire_on_commit=False, class_=AsyncSession)
