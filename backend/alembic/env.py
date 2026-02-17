from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy import engine_from_config
from alembic import context

from backend.core.config import settings
from backend.core.database import Base

# Import all models here so Alembic can detect them
from backend.models import (
    user,
    quiz,
    quiz_section,
    question,
    document,
    attempt,
    answer,
    violation,
    result,
    ai_job,
    student_profile
)

# Alembic Config object
config = context.config
config.set_main_option("sqlalchemy.url", settings.POSTGRES_DSN)

# Logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Target metadata for autogenerate
target_metadata = Base.metadata


# ----------------------------
# Offline migrations
# ----------------------------
def run_migrations_offline() -> None:
    context.configure(
        url=settings.POSTGRES_DSN,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


# ----------------------------
# Online migrations
# ----------------------------
def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section)
    configuration["sqlalchemy.url"] = settings.POSTGRES_DSN

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )

        with context.begin_transaction():
            context.run_migrations()


# ----------------------------
# Entrypoint
# ----------------------------
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
