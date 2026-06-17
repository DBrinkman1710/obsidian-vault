"""add unread_count to chat_sessions (merge heads)

Revision ID: y1z2a3b4c5d6
Revises: w3x4y5z6a7b8, r8s9t0u1v2w3
Create Date: 2026-06-16

"""
from alembic import op
import sqlalchemy as sa

revision = 'y1z2a3b4c5d6'
down_revision = ('w3x4y5z6a7b8', 'r8s9t0u1v2w3')
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'chat_sessions',
        sa.Column('unread_count', sa.Integer(), nullable=False, server_default='0'),
    )


def downgrade() -> None:
    op.drop_column('chat_sessions', 'unread_count')
