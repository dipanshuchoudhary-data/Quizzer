"""add notifications inbox

Revision ID: b4c5d6e7f8a9
Revises: e2f4a6b8c9d1
Create Date: 2026-04-07 10:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "b4c5d6e7f8a9"
down_revision = "e2f4a6b8c9d1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notification_messages",
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=20), nullable=False, server_default="announcement"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name=op.f("fk_notification_messages_created_by_users"), ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_notification_messages")),
    )
    op.create_index(op.f("ix_notification_messages_category"), "notification_messages", ["category"], unique=False)
    op.create_index(op.f("ix_notification_messages_created_by"), "notification_messages", ["created_by"], unique=False)
    op.alter_column("notification_messages", "category", server_default=None)
    op.alter_column("notification_messages", "is_active", server_default=None)

    op.create_table(
        "notification_reads",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("notification_id", sa.UUID(), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["notification_id"], ["notification_messages.id"], name=op.f("fk_notification_reads_notification_id_notification_messages"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_notification_reads_user_id_users"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_notification_reads")),
        sa.UniqueConstraint("user_id", "notification_id", name="uq_notification_reads_user_id_notification_id"),
    )
    op.create_index(op.f("ix_notification_reads_notification_id"), "notification_reads", ["notification_id"], unique=False)
    op.create_index(op.f("ix_notification_reads_user_id"), "notification_reads", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_notification_reads_user_id"), table_name="notification_reads")
    op.drop_index(op.f("ix_notification_reads_notification_id"), table_name="notification_reads")
    op.drop_table("notification_reads")
    op.drop_index(op.f("ix_notification_messages_created_by"), table_name="notification_messages")
    op.drop_index(op.f("ix_notification_messages_category"), table_name="notification_messages")
    op.drop_table("notification_messages")
