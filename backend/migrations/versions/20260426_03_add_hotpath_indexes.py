"""Add composite indexes on hot query paths.

The list/dashboard endpoints filter on user_id and order by created_at,
and the worker tables are polled by user_id+status. With ~5k applications
and 50k generated documents these full scans become measurable. All
indexes are created with ``CREATE INDEX IF NOT EXISTS`` semantics via
the inspector, so re-running on a partly-migrated DB is a no-op.

ON DELETE CASCADE rules on the foreign keys are intentionally NOT
applied here. Production runs with ``Base.metadata.create_all`` rather
than Alembic, so the FK definitions on disk may differ from this
migration's expectations. The cascade work belongs in a dedicated PR
once the migration drift (CLAUDE-2026.04.md P0-6 / P1-15) is sorted.

Revision ID: 20260426_03
Revises: 20260426_02
Create Date: 2026-04-26
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260426_03"
down_revision = "20260426_02"
branch_labels = None
depends_on = None


# (table, columns, index_name)
INDEXES = [
    ("applications", ["user_id", "created_at"], "ix_applications_user_created"),
    ("job_offers", ["user_id", "created_at"], "ix_job_offers_user_created"),
    ("job_offers", ["url"], "ix_job_offers_url"),
    ("documents", ["user_id", "doc_type"], "ix_documents_user_doctype"),
    ("generated_documents", ["application_id"], "ix_generated_documents_app"),
    ("generation_tasks", ["user_id", "status"], "ix_generation_tasks_user_status"),
    ("matching_score_tasks", ["user_id", "status"], "ix_matching_tasks_user_status"),
    ("matching_score_tasks", ["application_id"], "ix_matching_tasks_app"),
    ("user_activity_logs", ["user_id", "created_at"], "ix_user_activity_user_created"),
]


def _exists(inspector, table, index_name):
    if table not in inspector.get_table_names():
        return True  # treat as already-handled; nothing to create
    return any(idx["name"] == index_name for idx in inspector.get_indexes(table))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    for table, columns, index_name in INDEXES:
        if _exists(inspector, table, index_name):
            continue
        # Skip silently when a referenced column is missing (e.g. a partly
        # migrated DB) so the migration doesn't fail on stale schemas.
        cols = {c["name"] for c in inspector.get_columns(table)} if table in inspector.get_table_names() else set()
        if not all(c in cols for c in columns):
            continue
        op.create_index(index_name, table, columns)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    for table, _columns, index_name in INDEXES:
        if _exists(inspector, table, index_name):
            op.drop_index(index_name, table_name=table)
