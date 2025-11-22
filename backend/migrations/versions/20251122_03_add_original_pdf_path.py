"""Add original_pdf_path to job_offers table.

Revision ID: 20251122_03
Revises: 20251122_02
Create Date: 2025-11-22
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = "20251122_03"
down_revision = "20251122_02"
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

    # Add original_pdf_path column to job_offers table
    if _table_exists(inspector, "job_offers"):
        if not _column_exists(inspector, "job_offers", "original_pdf_path"):
            op.add_column("job_offers", sa.Column("original_pdf_path", sa.String(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    # Remove original_pdf_path column from job_offers table
    if _table_exists(inspector, "job_offers"):
        if _column_exists(inspector, "job_offers", "original_pdf_path"):
            op.drop_column("job_offers", "original_pdf_path")
