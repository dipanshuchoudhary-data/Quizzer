"""add google auth fields to users

Revision ID: c9f8e7d6b5a4
Revises: b4c5d6e7f8a9
Create Date: 2026-04-07 18:10:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "c9f8e7d6b5a4"
down_revision = "b4c5d6e7f8a9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("google_id", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("auth_provider", sa.String(length=50), nullable=False, server_default="email"))
    op.create_index(op.f("ix_users_google_id"), "users", ["google_id"], unique=True)
    op.alter_column("users", "auth_provider", server_default=None)


def downgrade() -> None:
    op.drop_index(op.f("ix_users_google_id"), table_name="users")
    op.drop_column("users", "auth_provider")
    op.drop_column("users", "google_id")
