"""add exam duration and institution type

Revision ID: c1a2b3d4e5f6
Revises: f2c94f3ce12a
Create Date: 2026-03-12 13:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c1a2b3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "f2c94f3ce12a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("quizzes", sa.Column("duration_minutes", sa.Integer(), nullable=False, server_default="60"))
    op.add_column("student_profiles", sa.Column("institution_type", sa.String(length=20), nullable=False, server_default="college"))
    op.alter_column("quizzes", "duration_minutes", server_default=None)
    op.alter_column("student_profiles", "institution_type", server_default=None)


def downgrade() -> None:
    op.drop_column("student_profiles", "institution_type")
    op.drop_column("quizzes", "duration_minutes")
