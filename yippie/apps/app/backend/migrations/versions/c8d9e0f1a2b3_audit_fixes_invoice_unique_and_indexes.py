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
    # Invoice numbers are per-tenant — replace the global unique with a composite one.
    op.execute("ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key")
    op.create_unique_constraint(
        'uq_invoices_tenant_number', 'invoices', ['tenant_id', 'invoice_number']
    )

    # Indexes for hot query paths.
    op.create_index('ix_draft_tickets_tenant_status', 'draft_tickets', ['tenant_id', 'status'])
    op.create_index('ix_pending_sends_send_at', 'pending_sends', ['send_at'])
    op.create_index('ix_pending_sends_tenant_draft', 'pending_sends', ['tenant_id', 'draft_id'])
    op.create_index('ix_contacts_tenant_email', 'contacts', ['tenant_id', 'email'])
    op.create_index('ix_ticket_comments_ticket_created', 'ticket_comments', ['ticket_id', 'created_at'])


def downgrade() -> None:
    op.drop_index('ix_ticket_comments_ticket_created', table_name='ticket_comments')
    op.drop_index('ix_contacts_tenant_email', table_name='contacts')
    op.drop_index('ix_pending_sends_tenant_draft', table_name='pending_sends')
    op.drop_index('ix_pending_sends_send_at', table_name='pending_sends')
    op.drop_index('ix_draft_tickets_tenant_status', table_name='draft_tickets')

    op.drop_constraint('uq_invoices_tenant_number', 'invoices', type_='unique')
    op.create_unique_constraint('invoices_invoice_number_key', 'invoices', ['invoice_number'])
