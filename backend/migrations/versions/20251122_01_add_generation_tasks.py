"""Add generation_tasks table for background document generation.

Revision ID: 20251122_01
Revises: 20241107_01
Create Date: 2025-11-22
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = "20251122_01"
down_revision = "20241107_01"
branch_labels = None
depends_on = None


def _table_exists(inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if not _table_exists(inspector, "generation_tasks"):
        op.create_table(
            "generation_tasks",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("application_id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("status", sa.String(), nullable=False, server_default="pending"),
            sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("total_docs", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("completed_docs", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["application_id"], ["applications.id"]),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_generation_tasks_id"), "generation_tasks", ["id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if _table_exists(inspector, "generation_tasks"):
        op.drop_index(op.f("ix_generation_tasks_id"), table_name="generation_tasks")
        op.drop_table("generation_tasks")
