"""Add document_templates table for configurable document generation.

Revision ID: 20251204_02
Revises: 20251204_01
Create Date: 2025-12-04
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = "20251204_02"
down_revision = "20251204_01"
branch_labels = None
depends_on = None


def _table_exists(inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    # Create document_templates table
    if not _table_exists(inspector, "document_templates"):
        op.create_table(
            "document_templates",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("doc_type", sa.String(), nullable=False),
            sa.Column("display_name", sa.String(), nullable=False),
            sa.Column("credit_cost", sa.Integer(), server_default="1", nullable=False),
            sa.Column("language_source", sa.String(), server_default="documentation_language", nullable=False),
            sa.Column("llm_provider", sa.String(), server_default="openai", nullable=False),
            sa.Column("llm_model", sa.String(), server_default="gpt-4", nullable=False),
            sa.Column("prompt_template", sa.Text(), nullable=False),
            sa.Column("is_active", sa.Boolean(), server_default="1", nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("doc_type"),
        )
        op.create_index("ix_document_templates_id", "document_templates", ["id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    # Drop document_templates table
    if _table_exists(inspector, "document_templates"):
        op.drop_index("ix_document_templates_id", table_name="document_templates")
        op.drop_table("document_templates")
