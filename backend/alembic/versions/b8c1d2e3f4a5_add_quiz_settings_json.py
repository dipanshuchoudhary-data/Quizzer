"""add quiz settings table

Revision ID: b8c1d2e3f4a5
Revises: e8f9a0b1c2d3
Create Date: 2026-03-12 13:05:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b8c1d2e3f4a5"
down_revision = "e8f9a0b1c2d3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "quiz_settings",
        sa.Column("quiz_id", sa.UUID(), nullable=False),
        sa.Column("owner_user_id", sa.UUID(), nullable=False),
        sa.Column("duration", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("default_marks", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("shuffle_questions", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("shuffle_options", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("require_fullscreen", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("block_tab_switch", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("block_copy_paste", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("violation_limit", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("negative_marking", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("penalty_wrong", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("violation_penalty", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("attempts_allowed", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("allow_resume", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("prevent_duplicate", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], name=op.f("fk_quiz_settings_owner_user_id_users"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["quiz_id"], ["quizzes.id"], name=op.f("fk_quiz_settings_quiz_id_quizzes"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_quiz_settings")),
        sa.UniqueConstraint("quiz_id", "owner_user_id", name="uq_quiz_settings_quiz_id_owner_user_id"),
    )
    op.create_index(op.f("ix_quiz_settings_owner_user_id"), "quiz_settings", ["owner_user_id"], unique=False)
    op.create_index(op.f("ix_quiz_settings_quiz_id"), "quiz_settings", ["quiz_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_quiz_settings_quiz_id"), table_name="quiz_settings")
    op.drop_index(op.f("ix_quiz_settings_owner_user_id"), table_name="quiz_settings")
    op.drop_table("quiz_settings")
