"""add verification context to student profiles

Revision ID: e2f4a6b8c9d1
Revises: a8b7c6d5e4f3
Create Date: 2026-04-07 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "e2f4a6b8c9d1"
down_revision = "a8b7c6d5e4f3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "student_profiles",
        sa.Column("verification_context", sa.String(length=50), nullable=False, server_default="college"),
    )
    op.add_column(
        "student_profiles",
        sa.Column("verification_data", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
    )

    op.execute(
        """
        UPDATE student_profiles
        SET verification_context = COALESCE(NULLIF(institution_type, ''), 'college'),
            verification_data = jsonb_strip_nulls(
                jsonb_build_object(
                    'student_name', student_name,
                    'enrollment_number', enrollment_number,
                    'course', course,
                    'section', section,
                    'batch', batch,
                    'semester', semester,
                    'class_name', class_name,
                    'class_section', class_section
                )
            )
        """
    )

    op.alter_column("student_profiles", "verification_context", server_default=None)
    op.alter_column("student_profiles", "verification_data", server_default=None)


def downgrade() -> None:
    op.drop_column("student_profiles", "verification_data")
    op.drop_column("student_profiles", "verification_context")
