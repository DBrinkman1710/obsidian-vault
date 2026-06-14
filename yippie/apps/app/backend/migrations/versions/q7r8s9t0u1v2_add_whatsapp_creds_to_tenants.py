"""Add per-tenant WhatsApp credentials to tenants table

Revision ID: q7r8s9t0u1v2
Revises: p6q7r8s9t0u1
Create Date: 2026-06-14

Adds whatsapp_phone_number_id, whatsapp_access_token, and whatsapp_verify_token
so each tenant stores its own Meta Cloud API credentials in the DB rather than
a shared YAML/env config. All nullable; existing tenants get NULL (WhatsApp
stays disabled until the superadmin fills these in).
"""

from alembic import op
import sqlalchemy as sa

revision = 'q7r8s9t0u1v2'
down_revision = 'p6q7r8s9t0u1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('tenants', sa.Column('whatsapp_phone_number_id', sa.String(100), nullable=True))
    op.add_column('tenants', sa.Column('whatsapp_access_token', sa.Text(), nullable=True))
    op.add_column('tenants', sa.Column('whatsapp_verify_token', sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column('tenants', 'whatsapp_verify_token')
    op.drop_column('tenants', 'whatsapp_access_token')
    op.drop_column('tenants', 'whatsapp_phone_number_id')
