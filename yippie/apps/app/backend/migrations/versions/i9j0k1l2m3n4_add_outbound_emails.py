"""add outbound_emails table for email tracking module

Revision ID: i9j0k1l2m3n4
Revises: h8i9j0k1l2m3
Create Date: 2026-06-12
"""
from typing import Sequence, Union
from alembic import op

revision: str = 'i9j0k1l2m3n4'
down_revision: Union[str, None] = 'h8i9j0k1l2m3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS outbound_emails (
            id UUID PRIMARY KEY,
            tenant_id UUID NOT NULL,
            resend_email_id VARCHAR(100) UNIQUE,
            to_email VARCHAR(255) NOT NULL,
            subject VARCHAR(500) NOT NULL,
            actor_id UUID,
            contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
            draft_id UUID,
            kind VARCHAR(20) NOT NULL DEFAULT 'compose',
            status VARCHAR(20) NOT NULL DEFAULT 'sent',
            delivered_at TIMESTAMPTZ,
            opened_at TIMESTAMPTZ,
            clicked_at TIMESTAMPTZ,
            clicked_count INTEGER NOT NULL DEFAULT 0,
            bounced_at TIMESTAMPTZ,
            bounce_type VARCHAR(20),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_outbound_emails_tenant_id ON outbound_emails (tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_outbound_emails_resend_email_id ON outbound_emails (resend_email_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_outbound_emails_contact_id ON outbound_emails (contact_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_outbound_emails_created_at ON outbound_emails (created_at)")

def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS outbound_emails")
