"""Add tokens_invalidated_after column to users.

Used by the JWT decoder to reject tokens issued before this timestamp,
which is how /logout, password change, admin demote and admin deactivate
revoke sessions without a server-side blocklist.

Revision ID: 20260426_02
Revises: 20260426_01
Create Date: 2026-04-26
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260426_02"
down_revision = "20260426_01"
branch_labels = None
depends_on = None


def _column_exists(inspector, table_name: str, column_name: str) -> bool:
    if table_name not in inspector.get_table_names():
        return False
    return any(c["name"] == column_name for c in inspector.get_columns(table_name))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if not _column_exists(inspector, "users", "tokens_invalidated_after"):
        op.add_column(
            "users",
            sa.Column("tokens_invalidated_after", sa.DateTime(), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if _column_exists(inspector, "users", "tokens_invalidated_after"):
        op.drop_column("users", "tokens_invalidated_after")
