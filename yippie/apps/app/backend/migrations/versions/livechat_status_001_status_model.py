"""livechat status model

Revision ID: livechat_status_001
Revises: c2d3e4f5a6b7
Create Date: 2026-06-18

Adds the chat session status lifecycle (open -> assigned -> solved -> ticket),
agent assignment, and per-tenant solved-chat auto-hide window.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = 'livechat_status_001'
down_revision: Union[str, None] = 'c2d3e4f5a6b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'chat_sessions',
        sa.Column('status', sa.String(length=20), nullable=False, server_default='open'),
    )
    op.add_column(
        'chat_sessions',
        sa.Column('assigned_to', UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        'chat_sessions',
        sa.Column('solved_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_foreign_key(
        'fk_chat_sessions_assigned_to_users',
        'chat_sessions',
        'users',
        ['assigned_to'],
        ['id'],
    )
    op.add_column(
        'tenants',
        sa.Column('hide_solved_chats_hours', sa.Integer(), nullable=False, server_default='72'),
    )


def downgrade() -> None:
    op.drop_column('tenants', 'hide_solved_chats_hours')
    op.drop_constraint('fk_chat_sessions_assigned_to_users', 'chat_sessions', type_='foreignkey')
    op.drop_column('chat_sessions', 'solved_at')
    op.drop_column('chat_sessions', 'assigned_to')
    op.drop_column('chat_sessions', 'status')
