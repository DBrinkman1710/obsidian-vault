"""Add whatsapp_webhook_secret to tenants

Revision ID: q1r2s3t4u5v6
Revises: p5q6r7s8t9u0
Create Date: 2026-07-01

Adds a per-tenant HMAC secret for the Evolution API WhatsApp webhook.
Existing rows are backfilled with a cryptographically random hex string
using Postgres's built-in gen_random_bytes(). New rows get the secret
from the application default; the column is non-nullable after backfill.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'q1r2s3t4u5v6'
down_revision: Union[str, None] = 'p5q6r7s8t9u0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tenants', sa.Column('whatsapp_webhook_secret', sa.String(100), nullable=True))
    op.execute("UPDATE tenants SET whatsapp_webhook_secret = encode(gen_random_bytes(32), 'hex') WHERE whatsapp_webhook_secret IS NULL")
    op.alter_column('tenants', 'whatsapp_webhook_secret', nullable=False, server_default='')


def downgrade() -> None:
    op.drop_column('tenants', 'whatsapp_webhook_secret')
