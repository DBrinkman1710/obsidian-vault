"""audit fixes: per-tenant invoice uniqueness + hot-path indexes

Revision ID: c8d9e0f1a2b3
Revises: b7c8d9e0f1a2
Create Date: 2026-06-10 00:00:00.000000

asyncpg requires one SQL statement per op.execute() call.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'c8d9e0f1a2b3'
down_revision: Union[str, None] = 'b7c8d9e0f1a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotent DDL throughout — devsandbox + sandbox deploy against one shared DB,
    # and some of these objects may already exist (e.g. ix_pending_sends_send_at).

    # Invoice numbers are per-tenant — replace the global unique with a composite one.
    op.execute("ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key")
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'uq_invoices_tenant_number'
            ) THEN
                ALTER TABLE invoices
                    ADD CONSTRAINT uq_invoices_tenant_number UNIQUE (tenant_id, invoice_number);
            END IF;
        END $$
        """
    )

    # Indexes for hot query paths.
    op.execute("CREATE INDEX IF NOT EXISTS ix_draft_tickets_tenant_status ON draft_tickets (tenant_id, status)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_pending_sends_send_at ON pending_sends (send_at)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_pending_sends_tenant_draft ON pending_sends (tenant_id, draft_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_contacts_tenant_email ON contacts (tenant_id, email)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ticket_comments_ticket_created ON ticket_comments (ticket_id, created_at)")


def downgrade() -> None:
    op.drop_index('ix_ticket_comments_ticket_created', table_name='ticket_comments')
    op.drop_index('ix_contacts_tenant_email', table_name='contacts')
    op.drop_index('ix_pending_sends_tenant_draft', table_name='pending_sends')
    op.drop_index('ix_pending_sends_send_at', table_name='pending_sends')
    op.drop_index('ix_draft_tickets_tenant_status', table_name='draft_tickets')

    op.drop_constraint('uq_invoices_tenant_number', 'invoices', type_='unique')
    op.create_unique_constraint('invoices_invoice_number_key', 'invoices', ['invoice_number'])
