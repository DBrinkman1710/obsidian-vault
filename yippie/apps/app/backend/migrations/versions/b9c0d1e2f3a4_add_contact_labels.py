"""add contact labels + contact_label_links (item 38)

Revision ID: b9c0d1e2f3a4
Revises: a7b8c9d0e1f2
Create Date: 2026-06-11

"""
from typing import Sequence, Union
from alembic import op


revision: str = 'b9c0d1e2f3a4'
down_revision: Union[str, None] = 'a7b8c9d0e1f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS contact_labels (
            id UUID PRIMARY KEY,
            tenant_id UUID NOT NULL,
            name VARCHAR(100) NOT NULL,
            color VARCHAR(7) NOT NULL DEFAULT '#64748b',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_contact_labels_tenant_id ON contact_labels (tenant_id)"
    )
    # One label name per tenant, case-insensitive.
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_contact_labels_tenant_lower_name "
        "ON contact_labels (tenant_id, lower(name))"
    )
    op.execute("""
        CREATE TABLE IF NOT EXISTS contact_label_links (
            contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
            label_id UUID NOT NULL REFERENCES contact_labels(id) ON DELETE CASCADE,
            PRIMARY KEY (contact_id, label_id)
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_contact_label_links_label_id ON contact_label_links (label_id)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS contact_label_links")
    op.execute("DROP TABLE IF EXISTS contact_labels")
