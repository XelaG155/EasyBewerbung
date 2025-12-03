"""Add location column to job_offers table.

Revision ID: 20251203_01
Revises: 20251122_05
Create Date: 2025-12-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = "20251203_01"
down_revision = "20251122_05"
branch_labels = None
depends_on = None


def _table_exists(inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def _column_exists(inspector, table_name: str, column_name: str) -> bool:
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    # Add location column to job_offers table
    if _table_exists(inspector, "job_offers"):
        if not _column_exists(inspector, "job_offers", "location"):
            op.add_column("job_offers", sa.Column("location", sa.String(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    # Remove location column from job_offers table
    if _table_exists(inspector, "job_offers"):
        if _column_exists(inspector, "job_offers", "location"):
            op.drop_column("job_offers", "location")
