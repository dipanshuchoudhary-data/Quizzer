"""add attempt status, score, and uniqueness

Revision ID: d7e8f9a0b1c2
Revises: c1a2b3d4e5f6
Create Date: 2026-03-12 16:10:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d7e8f9a0b1c2"
down_revision: Union[str, Sequence[str], None] = "c1a2b3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("attempts", sa.Column("enrollment_number", sa.String(length=100), nullable=True))
    op.add_column("attempts", sa.Column("status", sa.String(length=50), nullable=False, server_default="IN_PROGRESS"))
    op.add_column("attempts", sa.Column("final_score", sa.Integer(), nullable=False, server_default="0"))

    op.execute(
        """
        UPDATE attempts
        SET enrollment_number = student_profiles.enrollment_number
        FROM student_profiles
        WHERE student_profiles.attempt_id = attempts.id
        """
    )
    op.execute(
        """
        WITH ranked AS (
            SELECT id, quiz_id, enrollment_number,
                   ROW_NUMBER() OVER (PARTITION BY quiz_id, enrollment_number ORDER BY created_at ASC, id ASC) AS row_num
            FROM attempts
        )
        UPDATE attempts
        SET enrollment_number = attempts.enrollment_number || '-LEGACY-' || LEFT(attempts.id::text, 8)
        FROM ranked
        WHERE attempts.id = ranked.id
          AND ranked.row_num > 1
        """
    )

    op.alter_column("attempts", "enrollment_number", nullable=False)
    op.create_unique_constraint("uq_attempts_quiz_enrollment_number", "attempts", ["quiz_id", "enrollment_number"])

    op.alter_column("attempts", "status", server_default=None)
    op.alter_column("attempts", "final_score", server_default=None)


def downgrade() -> None:
    op.drop_constraint("uq_attempts_quiz_enrollment_number", "attempts", type_="unique")
    op.drop_column("attempts", "final_score")
    op.drop_column("attempts", "status")
    op.drop_column("attempts", "enrollment_number")
