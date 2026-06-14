"""Add broadcast_opted_out to contacts (item 30 — mail-all / broadcast)

Revision ID: p6q7r8s9t0u1
Revises: o5p6q7r8s9t0
Create Date: 2026-06-14

Adds the opt-out flag set when a contact clicks the unsubscribe link in a
broadcast email, plus a composite index on (tenant_id, broadcast_opted_out)
so the broadcast query filters cheaply per tenant.

Raw SQL DDL (op.execute) is used instead of op.add_column to stay consistent
with the RLS-aware migration pattern and to keep the NOT NULL DEFAULT explicit.
"""
from __future__ import annotations

from alembic import op
from sqlalchemy import text

revision = "p6q7r8s9t0u1"
down_revision = "o5p6q7r8s9t0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(text(
        "ALTER TABLE contacts "
        "ADD COLUMN IF NOT EXISTS broadcast_opted_out BOOLEAN NOT NULL DEFAULT false"
    ))
    op.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_contacts_tenant_broadcast_opted_out "
        "ON contacts (tenant_id, broadcast_opted_out)"
    ))


def downgrade() -> None:
    op.execute(text("DROP INDEX IF EXISTS ix_contacts_tenant_broadcast_opted_out"))
    op.execute(text("ALTER TABLE contacts DROP COLUMN IF EXISTS broadcast_opted_out"))
