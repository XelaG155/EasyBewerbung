"""Add credits-tracking and failed-docs columns to generation_tasks.

Adds three columns to support proper credits-refund and partial-failure
status:

- ``credits_held``: total credits deducted from the user when the task
  was queued. Source of truth for refund calculations.
- ``credits_refunded``: how many credits were refunded when the task
  settled (failed or partial_failure). Idempotency guard against
  double-refund on Celery retry.
- ``failed_docs``: counter parallel to ``completed_docs``, used to
  derive the final status (``completed`` if 0, ``partial_failure``
  if some, ``failed`` if all).

Revision ID: 20260426_01
Revises: 20260405_01
Create Date: 2026-04-26
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260426_01"
down_revision = "20260405_01"
branch_labels = None
depends_on = None


def _column_exists(inspector, table_name: str, column_name: str) -> bool:
    if table_name not in inspector.get_table_names():
        return False
    return any(c["name"] == column_name for c in inspector.get_columns(table_name))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if not _column_exists(inspector, "generation_tasks", "failed_docs"):
        op.add_column(
            "generation_tasks",
            sa.Column("failed_docs", sa.Integer(), nullable=False, server_default="0"),
        )
    if not _column_exists(inspector, "generation_tasks", "credits_held"):
        op.add_column(
            "generation_tasks",
            sa.Column("credits_held", sa.Integer(), nullable=False, server_default="0"),
        )
    if not _column_exists(inspector, "generation_tasks", "credits_refunded"):
        op.add_column(
            "generation_tasks",
            sa.Column("credits_refunded", sa.Integer(), nullable=False, server_default="0"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if _column_exists(inspector, "generation_tasks", "credits_refunded"):
        op.drop_column("generation_tasks", "credits_refunded")
    if _column_exists(inspector, "generation_tasks", "credits_held"):
        op.drop_column("generation_tasks", "credits_held")
    if _column_exists(inspector, "generation_tasks", "failed_docs"):
        op.drop_column("generation_tasks", "failed_docs")
