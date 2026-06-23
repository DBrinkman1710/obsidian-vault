"""[TRACK1] Add shipments module — Shipment, ShipmentEvent tables + Sendcloud tenant columns

Revision ID: track1_shipments_module
Revises: lang1_ui_language
Create Date: 2026-06-23

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = 'track1_shipments_module'
down_revision: Union[str, None] = 'lang1_ui_language'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'shipments',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', UUID(as_uuid=True), nullable=False),
        sa.Column('tracking_number', sa.String(255), nullable=False),
        sa.Column(
            'carrier',
            sa.Enum('sendcloud', 'postnl', 'dhl', 'dpd', 'ups', 'fedex', 'other', name='carrier'),
            nullable=False,
            server_default='other',
        ),
        sa.Column(
            'status',
            sa.Enum(
                'registered', 'in_transit', 'out_for_delivery', 'delivered',
                'exception', 'returned', 'cancelled',
                name='shipmentstatus',
            ),
            nullable=False,
            server_default='registered',
        ),
        sa.Column('contact_id', UUID(as_uuid=True), sa.ForeignKey('contacts.id'), nullable=True),
        sa.Column('order_reference', sa.String(255), nullable=True),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('estimated_delivery', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_event_description', sa.String(500), nullable=True),
        sa.Column('last_event_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_event_location', sa.String(255), nullable=True),
        sa.Column('sendcloud_parcel_id', sa.String(100), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_shipments_tenant_id', 'shipments', ['tenant_id'])
    op.create_index('ix_shipments_tracking_number', 'shipments', ['tracking_number'])
    op.create_index('ix_shipments_contact_id', 'shipments', ['contact_id'])
    op.create_index('ix_shipments_sendcloud_parcel_id', 'shipments', ['sendcloud_parcel_id'])
    op.create_index('ix_shipments_tenant_status', 'shipments', ['tenant_id', 'status'])
    op.create_index('ix_shipments_tenant_carrier', 'shipments', ['tenant_id', 'carrier'])

    op.create_table(
        'shipment_events',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', UUID(as_uuid=True), nullable=False),
        sa.Column(
            'shipment_id',
            UUID(as_uuid=True),
            sa.ForeignKey('shipments.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('event_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('location', sa.String(255), nullable=True),
        sa.Column('status_code', sa.String(50), nullable=True),
        sa.Column('description', sa.String(500), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_shipment_events_shipment_ts', 'shipment_events', ['shipment_id', 'event_at'])

    op.add_column('tenants', sa.Column('sendcloud_api_key', sa.Text, nullable=True))
    op.add_column('tenants', sa.Column('sendcloud_api_secret', sa.Text, nullable=True))


def downgrade() -> None:
    op.drop_column('tenants', 'sendcloud_api_secret')
    op.drop_column('tenants', 'sendcloud_api_key')
    op.drop_table('shipment_events')
    op.drop_table('shipments')
    op.execute("DROP TYPE IF EXISTS shipmentstatus")
    op.execute("DROP TYPE IF EXISTS carrier")
