"""BILLING2: add kvk/btw to tenants + pending/received/not_sent to invoicestatus

Revision ID: a0b1c2d3e4f5
Revises: c4d5e6f7a8b9
Create Date: 2026-06-17

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = 'a0b1c2d3e4f5'
down_revision: Union[str, None] = 'c4d5e6f7a8b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Dutch legal registration numbers on the tenant (shown on invoices/exports).
    op.add_column('tenants', sa.Column('kvk_nummer', sa.String(length=100), nullable=True))
    op.add_column('tenants', sa.Column('btw_nummer', sa.String(length=100), nullable=True))

    # New BILLING2 invoice statuses. Existing values are kept so current data is safe.
    op.execute("ALTER TYPE invoicestatus ADD VALUE IF NOT EXISTS 'pending'")
    op.execute("ALTER TYPE invoicestatus ADD VALUE IF NOT EXISTS 'received'")
    op.execute("ALTER TYPE invoicestatus ADD VALUE IF NOT EXISTS 'not_sent'")


def downgrade() -> None:
    op.drop_column('tenants', 'btw_nummer')
    op.drop_column('tenants', 'kvk_nummer')
    # Postgres does not support removing enum values.
