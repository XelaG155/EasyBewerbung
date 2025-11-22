"""Add admin features: activity logs, language settings, prompt templates, and user admin fields.

Revision ID: 20251122_02
Revises: 20251122_01
Create Date: 2025-11-22
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = "20251122_02"
down_revision = "20251122_01"
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

    # Add new columns to users table
    if _table_exists(inspector, "users"):
        if not _column_exists(inspector, "users", "is_admin"):
            op.add_column("users", sa.Column("is_admin", sa.Boolean(), server_default="0", nullable=False))
        if not _column_exists(inspector, "users", "is_active"):
            op.add_column("users", sa.Column("is_active", sa.Boolean(), server_default="1", nullable=False))
        if not _column_exists(inspector, "users", "last_login_at"):
            op.add_column("users", sa.Column("last_login_at", sa.DateTime(), nullable=True))
        if not _column_exists(inspector, "users", "password_changed_at"):
            op.add_column("users", sa.Column("password_changed_at", sa.DateTime(), nullable=True))
        if not _column_exists(inspector, "users", "privacy_policy_accepted_at"):
            op.add_column("users", sa.Column("privacy_policy_accepted_at", sa.DateTime(), nullable=True))

    # Create user_activity_logs table
    if not _table_exists(inspector, "user_activity_logs"):
        op.create_table(
            "user_activity_logs",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("action", sa.String(), nullable=False),
            sa.Column("ip_address", sa.String(), nullable=True),
            sa.Column("metadata", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_user_activity_logs_user_id", "user_activity_logs", ["user_id"], unique=False)
        op.create_index("ix_user_activity_logs_action", "user_activity_logs", ["action"], unique=False)
        op.create_index("ix_user_activity_logs_created_at", "user_activity_logs", ["created_at"], unique=False)

    # Create language_settings table
    if not _table_exists(inspector, "language_settings"):
        op.create_table(
            "language_settings",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("code", sa.String(), nullable=False),
            sa.Column("label", sa.String(), nullable=False),
            sa.Column("direction", sa.String(), server_default="ltr", nullable=True),
            sa.Column("is_active", sa.Boolean(), server_default="1", nullable=True),
            sa.Column("sort_order", sa.Integer(), server_default="0", nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("code"),
        )

    # Create prompt_templates table
    if not _table_exists(inspector, "prompt_templates"):
        op.create_table(
            "prompt_templates",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("doc_type", sa.String(), nullable=False),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    # Drop prompt_templates table
    if _table_exists(inspector, "prompt_templates"):
        op.drop_table("prompt_templates")

    # Drop language_settings table
    if _table_exists(inspector, "language_settings"):
        op.drop_table("language_settings")

    # Drop user_activity_logs table
    if _table_exists(inspector, "user_activity_logs"):
        op.drop_index("ix_user_activity_logs_created_at", table_name="user_activity_logs")
        op.drop_index("ix_user_activity_logs_action", table_name="user_activity_logs")
        op.drop_index("ix_user_activity_logs_user_id", table_name="user_activity_logs")
        op.drop_table("user_activity_logs")

    # Remove columns from users table
    if _table_exists(inspector, "users"):
        if _column_exists(inspector, "users", "privacy_policy_accepted_at"):
            op.drop_column("users", "privacy_policy_accepted_at")
        if _column_exists(inspector, "users", "password_changed_at"):
            op.drop_column("users", "password_changed_at")
        if _column_exists(inspector, "users", "last_login_at"):
            op.drop_column("users", "last_login_at")
        if _column_exists(inspector, "users", "is_active"):
            op.drop_column("users", "is_active")
        if _column_exists(inspector, "users", "is_admin"):
            op.drop_column("users", "is_admin")
