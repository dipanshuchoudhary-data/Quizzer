"""add role to users

Revision ID: 646207996c3a
Revises: 6a8194a5eb0c
Create Date: 2026-02-22 16:07:17.244692

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '646207996c3a'
down_revision: Union[str, Sequence[str], None] = '6a8194a5eb0c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.add_column(
        "users",
        sa.Column(
            "role",
            sa.String(length=50),
            nullable=False,
            server_default="ADMIN",
        ),
    )

    # Optional: remove default after creation (clean schema)
    op.alter_column("users", "role", server_default=None)


def downgrade():
    op.drop_column("users", "role")
