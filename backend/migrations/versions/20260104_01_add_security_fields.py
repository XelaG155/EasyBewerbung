"""Add security fields for account lockout mechanism.

Revision ID: 20260104_01
Revises: 20251208_01
Create Date: 2026-01-04
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = "20260104_01"
down_revision = "20251208_01"
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

    # Add security columns to users table
    if _table_exists(inspector, "users"):
        if not _column_exists(inspector, "users", "failed_login_attempts"):
            op.add_column("users", sa.Column("failed_login_attempts", sa.Integer(), server_default="0", nullable=False))
        if not _column_exists(inspector, "users", "account_locked_until"):
            op.add_column("users", sa.Column("account_locked_until", sa.DateTime(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    # Remove security columns from users table
    if _table_exists(inspector, "users"):
        if _column_exists(inspector, "users", "account_locked_until"):
            op.drop_column("users", "account_locked_until")
        if _column_exists(inspector, "users", "failed_login_attempts"):
            op.drop_column("users", "failed_login_attempts")
