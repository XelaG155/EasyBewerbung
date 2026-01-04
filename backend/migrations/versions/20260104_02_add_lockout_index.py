"""Add index on account_locked_until for performance.

Revision ID: 20260104_02
Revises: 20260104_01
Create Date: 2026-01-04
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = "20260104_02"
down_revision = "20260104_01"
branch_labels = None
depends_on = None


def _table_exists(inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def _index_exists(inspector, table_name: str, index_name: str) -> bool:
    indexes = inspector.get_indexes(table_name)
    return any(idx['name'] == index_name for idx in indexes)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    # Add index on account_locked_until for better query performance
    if _table_exists(inspector, "users"):
        index_name = "ix_users_account_locked_until"
        if not _index_exists(inspector, "users", index_name):
            op.create_index(index_name, "users", ["account_locked_until"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    # Drop index on account_locked_until
    if _table_exists(inspector, "users"):
        index_name = "ix_users_account_locked_until"
        if _index_exists(inspector, "users", index_name):
            op.drop_index(index_name, table_name="users")
