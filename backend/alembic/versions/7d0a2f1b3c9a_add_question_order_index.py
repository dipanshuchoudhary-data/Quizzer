"""add question order index

Revision ID: 7d0a2f1b3c9a
Revises: b8c1d2e3f4a5
Create Date: 2026-03-15 06:25:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "7d0a2f1b3c9a"
down_revision = "b8c1d2e3f4a5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("questions", sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"))
    op.execute("UPDATE questions SET order_index = 0 WHERE order_index IS NULL")


def downgrade() -> None:
    op.drop_column("questions", "order_index")
