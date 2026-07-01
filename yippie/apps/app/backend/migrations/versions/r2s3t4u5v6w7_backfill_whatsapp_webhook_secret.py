"""Backfill empty whatsapp_webhook_secret values

Revision ID: r2s3t4u5v6w7
Revises: q1r2s3t4u5v6
Create Date: 2026-07-01

The q1r2s3t4u5v6 migration added whatsapp_webhook_secret and backfilled NULLs,
but tenants whose rows were created with the column's server_default of '' may
still have an empty secret, which causes the fail-closed auth check to reject
all requests. This migration regenerates the secret for any tenant with an
empty or NULL value.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'r2s3t4u5v6w7'
down_revision: Union[str, None] = 'q1r2s3t4u5v6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "UPDATE tenants "
        "SET whatsapp_webhook_secret = encode(gen_random_bytes(32), 'hex') "
        "WHERE whatsapp_webhook_secret IS NULL OR whatsapp_webhook_secret = ''"
    )


def downgrade() -> None:
    # Cannot restore original (empty) secrets — no-op
    pass
