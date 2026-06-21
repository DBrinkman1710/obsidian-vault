"""chat_message_media_fields

Revision ID: lm7n8o9p0q1r
Revises: 243646e386fc, mktg2_design_json_on_templates
Create Date: 2026-06-21 00:00:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'lm7n8o9p0q1r'
down_revision: Union[str, Sequence[str], None] = ('243646e386fc', 'mktg2_design_json_on_templates')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('chat_messages', sa.Column('msg_type', sa.String(20), nullable=False, server_default='text'))
    op.add_column('chat_messages', sa.Column('media_url', sa.Text(), nullable=True))
    op.add_column('chat_messages', sa.Column('media_filename', sa.String(500), nullable=True))
    op.add_column('chat_messages', sa.Column('media_mime', sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column('chat_messages', 'media_mime')
    op.drop_column('chat_messages', 'media_filename')
    op.drop_column('chat_messages', 'media_url')
    op.drop_column('chat_messages', 'msg_type')
