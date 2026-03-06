"""add difficulty to questions

Revision ID: a1f9b3c7d2e4
Revises: 9b2f9da4e1ac
Create Date: 2026-03-01 10:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1f9b3c7d2e4"
down_revision: Union[str, Sequence[str], None] = "9b2f9da4e1ac"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("questions", sa.Column("difficulty", sa.String(length=20), nullable=True))
    op.execute("UPDATE questions SET difficulty = 'Medium' WHERE difficulty IS NULL")


def downgrade() -> None:
    op.drop_column("questions", "difficulty")

