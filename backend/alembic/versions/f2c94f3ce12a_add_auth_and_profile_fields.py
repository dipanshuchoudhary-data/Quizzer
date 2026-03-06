"""add auth and profile fields

Revision ID: f2c94f3ce12a
Revises: a1f9b3c7d2e4
Create Date: 2026-03-04 20:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f2c94f3ce12a"
down_revision: Union[str, Sequence[str], None] = "a1f9b3c7d2e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("full_name", sa.String(length=255), nullable=False, server_default="Professor"))
    op.add_column("users", sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("users", sa.Column("email_verification_token_hash", sa.String(length=128), nullable=True))
    op.add_column("users", sa.Column("email_verification_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("phone_number", sa.String(length=20), nullable=True))
    op.add_column("users", sa.Column("institution", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("country", sa.String(length=120), nullable=True))
    op.add_column("users", sa.Column("timezone", sa.String(length=120), nullable=True))
    op.add_column("users", sa.Column("subject_area", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("courses_taught", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("teaching_experience", sa.String(length=120), nullable=True))
    op.add_column("users", sa.Column("avatar_url", sa.String(length=500), nullable=True))
    op.add_column("users", sa.Column("onboarding_completed", sa.Boolean(), nullable=False, server_default=sa.false()))

    op.create_index(op.f("ix_users_phone_number"), "users", ["phone_number"], unique=True)

    op.create_table(
        "auth_otps",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("phone_number", sa.String(length=20), nullable=False),
        sa.Column("otp_hash", sa.String(length=255), nullable=False),
        sa.Column("purpose", sa.String(length=50), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_auth_otps_user_id_users"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_auth_otps")),
    )
    op.create_index(op.f("ix_auth_otps_phone_number"), "auth_otps", ["phone_number"], unique=False)
    op.create_index(op.f("ix_auth_otps_user_id"), "auth_otps", ["user_id"], unique=False)

    op.alter_column("users", "full_name", server_default=None)
    op.alter_column("users", "is_verified", server_default=None)
    op.alter_column("users", "onboarding_completed", server_default=None)


def downgrade() -> None:
    op.drop_index(op.f("ix_auth_otps_user_id"), table_name="auth_otps")
    op.drop_index(op.f("ix_auth_otps_phone_number"), table_name="auth_otps")
    op.drop_table("auth_otps")

    op.drop_index(op.f("ix_users_phone_number"), table_name="users")
    op.drop_column("users", "onboarding_completed")
    op.drop_column("users", "avatar_url")
    op.drop_column("users", "teaching_experience")
    op.drop_column("users", "courses_taught")
    op.drop_column("users", "subject_area")
    op.drop_column("users", "timezone")
    op.drop_column("users", "country")
    op.drop_column("users", "institution")
    op.drop_column("users", "phone_number")
    op.drop_column("users", "email_verification_expires_at")
    op.drop_column("users", "email_verification_token_hash")
    op.drop_column("users", "is_verified")
    op.drop_column("users", "full_name")
