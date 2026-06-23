"""[TRACK2] ERP order webhook support — nullable tracking_number, order_ref index, orders_webhook_secret

Revision ID: trk2_erp_webhook_support
Revises: track1_shipments_module
Create Date: 2026-06-23

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'trk2_erp_webhook_support'
down_revision: Union[str, None] = 'track1_shipments_module'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Allow shipments without a tracking number (ERP orders not yet shipped)
    op.alter_column('shipments', 'tracking_number',
                    existing_type=sa.String(255),
                    nullable=True)

    # Fast upsert lookup by order_reference within a tenant
    op.create_index('ix_shipments_tenant_order_ref', 'shipments', ['tenant_id', 'order_reference'])

    # Per-tenant secret for the generic ERP orders webhook
    op.add_column('tenants', sa.Column('orders_webhook_secret', sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column('tenants', 'orders_webhook_secret')
    op.drop_index('ix_shipments_tenant_order_ref', table_name='shipments')
    op.alter_column('shipments', 'tracking_number',
                    existing_type=sa.String(255),
                    nullable=False)
