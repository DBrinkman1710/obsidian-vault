"""Invoice overhaul: tenant address/IBAN + invoice date/notes columns

Revision ID: inv1_invoice_overhaul
Revises: ai1_enable_module
Create Date: 2026-06-29

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'inv1_invoice_overhaul'
down_revision: Union[str, None] = 'ai1_enable_module'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Tenant: invoice sender address + IBAN
    op.add_column('tenants', sa.Column('street_address', sa.String(255), nullable=True))
    op.add_column('tenants', sa.Column('postal_code', sa.String(20), nullable=True))
    op.add_column('tenants', sa.Column('city', sa.String(100), nullable=True))
    op.add_column('tenants', sa.Column('country', sa.String(100), nullable=True, server_default='Nederland'))
    op.add_column('tenants', sa.Column('iban', sa.String(34), nullable=True))
    op.add_column('tenants', sa.Column('phone', sa.String(50), nullable=True))

    # Invoice: formal invoice date + payment/notes field
    op.add_column('invoices', sa.Column('invoice_date', sa.Date(), nullable=True))
    op.add_column('invoices', sa.Column('notes', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('invoices', 'notes')
    op.drop_column('invoices', 'invoice_date')
    op.drop_column('tenants', 'phone')
    op.drop_column('tenants', 'iban')
    op.drop_column('tenants', 'country')
    op.drop_column('tenants', 'city')
    op.drop_column('tenants', 'postal_code')
    op.drop_column('tenants', 'street_address')
