"""flows5 — webhook trigger token + per-tenant outbound signing secret ([FLOW5])

Two columns back the Flows webhook feature:
  - flows.webhook_token: the per-flow secret in the public inbound URL
    (POST /api/v1/flows/hook/{token}). Unique + indexed so the unauthenticated
    handler resolves the flow in one lookup. Only webhook-trigger flows carry
    one; NULL for every other flow (a partial unique index allows many NULLs).
  - tenants.flow_webhook_secret: the HMAC-SHA256 key the send_webhook action
    signs outbound requests with (X-Yippie-Signature header). Per tenant,
    minted lazily, rotatable from the builder.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "flows5_webhooks"
down_revision: Union[str, None] = "req1_booking_requests"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE flows ADD COLUMN IF NOT EXISTS webhook_token VARCHAR(64)")
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_flows_webhook_token"
        " ON flows (webhook_token) WHERE webhook_token IS NOT NULL"
    )
    op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS flow_webhook_secret VARCHAR(100)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_flows_webhook_token")
    op.execute("ALTER TABLE flows DROP COLUMN IF EXISTS webhook_token")
    op.execute("ALTER TABLE tenants DROP COLUMN IF EXISTS flow_webhook_secret")
