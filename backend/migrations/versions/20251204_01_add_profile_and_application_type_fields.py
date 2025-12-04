"""Add extended profile fields and application_type.

Adds to users table:
- employment_status: Current employment status (employed, unemployed, student, transitioning)
- education_type: Type of education (wms, bms, university, apprenticeship, other)
- additional_profile_context: Free text for additional profile information

Adds to applications table:
- application_type: Type of application (fulltime, internship, apprenticeship)

Revision ID: 20251204_01
Revises: 20251203_01
Create Date: 2025-12-04
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = "20251204_01"
down_revision = "20251203_01"
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

    # Add extended profile fields to users table
    if _table_exists(inspector, "users"):
        if not _column_exists(inspector, "users", "employment_status"):
            op.add_column("users", sa.Column("employment_status", sa.String(), nullable=True))
        if not _column_exists(inspector, "users", "education_type"):
            op.add_column("users", sa.Column("education_type", sa.String(), nullable=True))
        if not _column_exists(inspector, "users", "additional_profile_context"):
            op.add_column("users", sa.Column("additional_profile_context", sa.Text(), nullable=True))

    # Add application_type to applications table
    if _table_exists(inspector, "applications"):
        if not _column_exists(inspector, "applications", "application_type"):
            op.add_column("applications", sa.Column("application_type", sa.String(), nullable=False, server_default="fulltime"))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    # Remove extended profile fields from users table
    if _table_exists(inspector, "users"):
        if _column_exists(inspector, "users", "employment_status"):
            op.drop_column("users", "employment_status")
        if _column_exists(inspector, "users", "education_type"):
            op.drop_column("users", "education_type")
        if _column_exists(inspector, "users", "additional_profile_context"):
            op.drop_column("users", "additional_profile_context")

    # Remove application_type from applications table
    if _table_exists(inspector, "applications"):
        if _column_exists(inspector, "applications", "application_type"):
            op.drop_column("applications", "application_type")
