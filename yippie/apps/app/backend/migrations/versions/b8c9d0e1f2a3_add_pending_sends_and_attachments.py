"""add pending_sends table and attachments_json to inbound_messages

Revision ID: b8c9d0e1f2a3
Revises: a6b7c8d9e0f1
Create Date: 2026-06-05

"""
from typing import Sequence, Union
from alembic import op


revision: str = 'b8c9d0e1f2a3'
down_revision: Union[str, None] = 'a6b7c8d9e0f1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Attachment metadata on received emails (JSON array of {id, filename, content_type})
    op.execute(
        "ALTER TABLE inbound_messages ADD COLUMN IF NOT EXISTS attachments_json TEXT"
    )

    # Pending sends queue for undo-send feature (5s delay before dispatch)
    op.execute("""
        CREATE TABLE IF NOT EXISTS pending_sends (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            draft_id UUID NOT NULL,
            tenant_id UUID NOT NULL,
            to_email VARCHAR(255) NOT NULL,
            subject VARCHAR(500) NOT NULL,
            reply_text TEXT NOT NULL,
            send_at TIMESTAMPTZ NOT NULL,
            actor_id UUID,
            contact_id UUID,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_pending_sends_send_at ON pending_sends (send_at)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_pending_sends_send_at")
    op.execute("DROP TABLE IF EXISTS pending_sends")
    op.execute("ALTER TABLE inbound_messages DROP COLUMN IF EXISTS attachments_json")
