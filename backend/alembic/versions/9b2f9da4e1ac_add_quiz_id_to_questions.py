"""add quiz_id to questions

Revision ID: 9b2f9da4e1ac
Revises: 7f1f3f176c24
Create Date: 2026-02-23 22:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9b2f9da4e1ac"
down_revision: Union[str, Sequence[str], None] = "7f1f3f176c24"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("questions", sa.Column("quiz_id", sa.UUID(), nullable=True))
    op.execute(
        """
        UPDATE questions q
        SET quiz_id = s.quiz_id
        FROM quiz_sections s
        WHERE q.section_id = s.id
        """
    )
    op.alter_column("questions", "quiz_id", nullable=False)
    op.create_foreign_key(
        "fk_questions_quiz_id_quizzes",
        "questions",
        "quizzes",
        ["quiz_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint("fk_questions_quiz_id_quizzes", "questions", type_="foreignkey")
    op.drop_column("questions", "quiz_id")

