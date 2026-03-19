"""add public_id to quizzes

Revision ID: 3c4d5e6f7a8b
Revises: 7d0a2f1b3c9a, d1e2f3a4b5c6
Create Date: 2026-03-19 05:10:00.000000

"""

from typing import Sequence, Union
import secrets

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "3c4d5e6f7a8b"
down_revision: Union[str, Sequence[str], None] = ("7d0a2f1b3c9a", "d1e2f3a4b5c6")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _generate_public_id(existing_ids: set[str]) -> str:
    while True:
        candidate = secrets.token_urlsafe(9).replace("-", "").replace("_", "")
        if candidate not in existing_ids:
            existing_ids.add(candidate)
            return candidate


def upgrade() -> None:
    op.add_column("quizzes", sa.Column("public_id", sa.String(length=64), nullable=True))

    quizzes = sa.table(
        "quizzes",
        sa.column("id", sa.Uuid()),
        sa.column("public_slug", sa.String()),
        sa.column("public_id", sa.String()),
        sa.column("is_published", sa.Boolean()),
    )
    bind = op.get_bind()

    rows = bind.execute(
        sa.select(quizzes.c.id, quizzes.c.public_slug, quizzes.c.is_published)
    ).fetchall()

    existing_ids = {row.public_slug for row in rows if row.public_slug}
    updates: list[dict[str, str]] = []
    for row in rows:
        public_id = row.public_slug or (_generate_public_id(existing_ids) if row.is_published else None)
        if public_id:
            updates.append({"quiz_id": row.id, "public_id": public_id})

    for update in updates:
        bind.execute(
            quizzes.update()
            .where(quizzes.c.id == update["quiz_id"])
            .values(public_id=update["public_id"])
        )

    op.create_index("ix_quizzes_public_id", "quizzes", ["public_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_quizzes_public_id", table_name="quizzes")
    op.drop_column("quizzes", "public_id")
