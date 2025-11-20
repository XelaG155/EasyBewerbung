"""Add language fields and credits tracking with validation-friendly defaults.

Revision ID: 20241107_01
Revises: 
Create Date: 2024-11-07
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

from app.language_catalog import DEFAULT_LANGUAGE

# revision identifiers, used by Alembic.
revision = "20241107_01"
down_revision = None
branch_labels = None
depends_on = None


def _column_missing(inspector, table_name: str, column_name: str) -> bool:
    return column_name not in {col["name"] for col in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if _column_missing(inspector, "users", "mother_tongue"):
        op.add_column(
            "users",
            sa.Column("mother_tongue", sa.String(), nullable=True, server_default=DEFAULT_LANGUAGE),
        )
    if _column_missing(inspector, "users", "documentation_language"):
        op.add_column(
            "users",
            sa.Column("documentation_language", sa.String(), nullable=True, server_default=DEFAULT_LANGUAGE),
        )
    if _column_missing(inspector, "users", "credits"):
        op.add_column("users", sa.Column("credits", sa.Integer(), nullable=False, server_default="0"))

    if _column_missing(inspector, "applications", "ui_language"):
        op.add_column(
            "applications",
            sa.Column("ui_language", sa.String(), nullable=True, server_default=DEFAULT_LANGUAGE),
        )
    if _column_missing(inspector, "applications", "documentation_language"):
        op.add_column(
            "applications",
            sa.Column("documentation_language", sa.String(), nullable=True, server_default=DEFAULT_LANGUAGE),
        )
    if _column_missing(inspector, "applications", "company_profile_language"):
        op.add_column(
            "applications",
            sa.Column("company_profile_language", sa.String(), nullable=True, server_default=DEFAULT_LANGUAGE),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if not _column_missing(inspector, "applications", "company_profile_language"):
        op.drop_column("applications", "company_profile_language")
    if not _column_missing(inspector, "applications", "documentation_language"):
        op.drop_column("applications", "documentation_language")
    if not _column_missing(inspector, "applications", "ui_language"):
        op.drop_column("applications", "ui_language")

    if not _column_missing(inspector, "users", "credits"):
        op.drop_column("users", "credits")
    if not _column_missing(inspector, "users", "documentation_language"):
        op.drop_column("users", "documentation_language")
    if not _column_missing(inspector, "users", "mother_tongue"):
        op.drop_column("users", "mother_tongue")
