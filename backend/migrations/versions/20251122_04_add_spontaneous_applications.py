"""Add spontaneous application fields

Revision ID: 20251122_04
Revises: 20251122_03
Create Date: 2025-11-22
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = "20251122_04"
down_revision = "20251122_03"
branch_labels = None
depends_on = None


def _table_exists(inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def _column_exists(inspector, table_name: str, column_name: str) -> bool:
    return column_name in [col["name"] for col in inspector.get_columns(table_name)]


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if _table_exists(inspector, "applications"):
        if not _column_exists(inspector, "applications", "is_spontaneous"):
            op.add_column(
                "applications",
                sa.Column("is_spontaneous", sa.Boolean(), nullable=False, server_default=sa.false()),
            )
            op.alter_column("applications", "is_spontaneous", server_default=None)

        if not _column_exists(inspector, "applications", "opportunity_context"):
            op.add_column(
                "applications",
                sa.Column("opportunity_context", sa.Text(), nullable=True),
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if _table_exists(inspector, "applications"):
        if _column_exists(inspector, "applications", "opportunity_context"):
            op.drop_column("applications", "opportunity_context")
        if _column_exists(inspector, "applications", "is_spontaneous"):
            op.drop_column("applications", "is_spontaneous")
