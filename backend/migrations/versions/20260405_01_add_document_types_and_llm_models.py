"""Add document_types and llm_models tables.

Introduces two new tables as part of the admin-forms refactor:

- ``document_types``: single source of truth for the document catalog
  (replaces the hard-coded dicts in ``app/document_catalog.py``).
- ``llm_models``: admin-manageable catalog of LLM models
  (replaces the hard-coded ``availableModels`` dict in the frontend admin page).

The existing ``document_templates`` table is left untouched — the relationship
is via the string key ``document_templates.doc_type`` == ``document_types.key``
so existing business logic (``ALLOWED_GENERATED_DOC_TYPES``, Celery tasks)
continues to work without modification.

Data is seeded in a separate script (``app/seed_catalog_to_db.py``) rather than
in this migration, to keep schema changes and data changes decoupled.

Revision ID: 20260405_01
Revises: 20260104_02
Create Date: 2026-04-05
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = "20260405_01"
down_revision = "20260104_02"
branch_labels = None
depends_on = None


def _table_exists(inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def _index_exists(inspector, table_name: str, index_name: str) -> bool:
    if not _table_exists(inspector, table_name):
        return False
    return any(idx["name"] == index_name for idx in inspector.get_indexes(table_name))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    # --- document_types ---------------------------------------------------
    if not _table_exists(inspector, "document_types"):
        op.create_table(
            "document_types",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("key", sa.String(), nullable=False),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("outputs", sa.Text(), nullable=False, server_default="[]"),
            sa.Column(
                "category",
                sa.String(),
                nullable=False,
                server_default="essential_pack",
            ),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("key", name="uq_document_types_key"),
        )
        # Re-fetch inspector after table creation for index checks.
        inspector = inspect(bind)

    if not _index_exists(inspector, "document_types", "ix_document_types_id"):
        op.create_index("ix_document_types_id", "document_types", ["id"], unique=False)
    if not _index_exists(inspector, "document_types", "ix_document_types_key"):
        op.create_index("ix_document_types_key", "document_types", ["key"], unique=False)
    if not _index_exists(inspector, "document_types", "ix_document_types_category"):
        op.create_index(
            "ix_document_types_category", "document_types", ["category"], unique=False
        )

    # --- llm_models -------------------------------------------------------
    inspector = inspect(bind)
    if not _table_exists(inspector, "llm_models"):
        op.create_table(
            "llm_models",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("provider", sa.String(), nullable=False),
            sa.Column("model_id", sa.String(), nullable=False),
            sa.Column("display_name", sa.String(), nullable=False),
            sa.Column("context_window", sa.Integer(), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "provider", "model_id", name="uq_llm_models_provider_model"
            ),
        )
        inspector = inspect(bind)

    if not _index_exists(inspector, "llm_models", "ix_llm_models_id"):
        op.create_index("ix_llm_models_id", "llm_models", ["id"], unique=False)
    if not _index_exists(inspector, "llm_models", "ix_llm_models_provider"):
        op.create_index(
            "ix_llm_models_provider", "llm_models", ["provider"], unique=False
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    # --- llm_models -------------------------------------------------------
    if _index_exists(inspector, "llm_models", "ix_llm_models_provider"):
        op.drop_index("ix_llm_models_provider", table_name="llm_models")
    if _index_exists(inspector, "llm_models", "ix_llm_models_id"):
        op.drop_index("ix_llm_models_id", table_name="llm_models")
    if _table_exists(inspector, "llm_models"):
        op.drop_table("llm_models")

    # --- document_types ---------------------------------------------------
    inspector = inspect(bind)
    if _index_exists(inspector, "document_types", "ix_document_types_category"):
        op.drop_index("ix_document_types_category", table_name="document_types")
    if _index_exists(inspector, "document_types", "ix_document_types_key"):
        op.drop_index("ix_document_types_key", table_name="document_types")
    if _index_exists(inspector, "document_types", "ix_document_types_id"):
        op.drop_index("ix_document_types_id", table_name="document_types")
    if _table_exists(inspector, "document_types"):
        op.drop_table("document_types")
