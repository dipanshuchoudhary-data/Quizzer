"""add public_slug to quizzes

Revision ID: 7f1f3f176c24
Revises: 646207996c3a
Create Date: 2026-02-23 22:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "7f1f3f176c24"
down_revision: Union[str, Sequence[str], None] = "646207996c3a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("quizzes", sa.Column("public_slug", sa.String(length=64), nullable=True))
    op.create_unique_constraint("uq_quizzes_public_slug", "quizzes", ["public_slug"])


def downgrade() -> None:
    op.drop_constraint("uq_quizzes_public_slug", "quizzes", type_="unique")
    op.drop_column("quizzes", "public_slug")

