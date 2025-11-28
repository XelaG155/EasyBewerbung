"""Add story field to matching scores

Revision ID: 20251122_05
Revises: 20251122_04
Create Date: 2025-11-22
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = "20251122_05"
down_revision = "20251122_04"
branch_labels = None
depends_on = None


def _table_exists(inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def _column_exists(inspector, table_name: str, column_name: str) -> bool:
    return column_name in [col["name"] for col in inspector.get_columns(table_name)]


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if _table_exists(inspector, "matching_scores"):
        if not _column_exists(inspector, "matching_scores", "story"):
            op.add_column(
                "matching_scores",
                sa.Column("story", sa.Text(), nullable=True),
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if _table_exists(inspector, "matching_scores"):
        if _column_exists(inspector, "matching_scores", "story"):
            op.drop_column("matching_scores", "story")
