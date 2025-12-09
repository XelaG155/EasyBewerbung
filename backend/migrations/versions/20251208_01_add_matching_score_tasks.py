"""Add matching_score_tasks table for async matching score calculation

Revision ID: 20251208_01
Revises: 20251204_02
Create Date: 2024-12-08
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20251208_01'
down_revision = '20251204_02'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'matching_score_tasks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('application_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['application_id'], ['applications.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_matching_score_tasks_id'), 'matching_score_tasks', ['id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_matching_score_tasks_id'), table_name='matching_score_tasks')
    op.drop_table('matching_score_tasks')
