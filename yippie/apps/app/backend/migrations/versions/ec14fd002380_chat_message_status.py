"""add msg_status and evolution_msg_id to chat_messages

Revision ID: ec14fd002380
Revises: z9a0b1c2d3e4
Create Date: 2026-06-18
"""
from __future__ import annotations
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = 'ec14fd002380'
down_revision: Union[str, Sequence[str], None] = 'z9a0b1c2d3e4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('chat_messages', sa.Column('msg_status', sa.String(20), nullable=False, server_default='sent'))
    op.add_column('chat_messages', sa.Column('evolution_msg_id', sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column('chat_messages', 'evolution_msg_id')
    op.drop_column('chat_messages', 'msg_status')
