"""livechat session dedup indexes

Revision ID: a0b1c2d3e4f6
Revises: z9a0b1c2d3e4
Create Date: 2026-06-18

Adds two partial unique indexes on chat_sessions to prevent duplicate open
sessions racing through concurrent inbound webhooks or WebSocket connections:

  uix_chat_sessions_open_whatsapp  — (tenant_id, whatsapp_phone) WHERE is_open
  uix_chat_sessions_open_visitor   — (tenant_id, visitor_id, source) WHERE is_open

Both indexes are scoped to is_open = TRUE so they only block concurrent opens;
historical closed sessions for the same contact/visitor are unaffected.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a0b1c2d3e4f6'
down_revision: Union[str, None] = 'z9a0b1c2d3e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Prevent two concurrent inbound WhatsApp webhooks for the same phone number
    # both inserting a new open session for the same tenant.
    op.create_index(
        'uix_chat_sessions_open_whatsapp',
        'chat_sessions',
        ['tenant_id', 'whatsapp_phone'],
        unique=True,
        postgresql_where=sa.text('is_open = TRUE'),
    )

    # Prevent duplicate open WebSocket sessions for the same browser visitor on
    # the same tenant + source combination.
    op.create_index(
        'uix_chat_sessions_open_visitor',
        'chat_sessions',
        ['tenant_id', 'visitor_id', 'source'],
        unique=True,
        postgresql_where=sa.text('is_open = TRUE'),
    )


def downgrade() -> None:
    op.drop_index('uix_chat_sessions_open_visitor', table_name='chat_sessions')
    op.drop_index('uix_chat_sessions_open_whatsapp', table_name='chat_sessions')
