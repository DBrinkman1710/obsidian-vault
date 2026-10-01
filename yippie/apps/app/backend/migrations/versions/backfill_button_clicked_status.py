"""backfill campaign_analytics clicked status from used button tokens

Button clicks were recorded only in label_click_tokens.used_at and never
advanced the recipient's campaign_analytics.status, so the Clicked KPI read 0
for every campaign. This replays existing used button tokens (those with a
campaign_id) into campaign_analytics so historical campaigns reflect the clicks
already visible in the per button breakdown.

Only advances rows currently at 'sent' or 'opened' — never downgrades a
'replied' recipient. Tokens predating per-campaign scoping (campaign_id NULL)
are skipped because they can't be mapped to one campaign unambiguously.

Revision ID: backfill_button_clicked_status
Revises: campaign_id_click_tokens
Create Date: 2026-10-01

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = 'backfill_button_clicked_status'
down_revision: Union[str, None] = 'campaign_id_click_tokens'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE campaign_analytics ca
        SET status = 'clicked', updated_at = now()
        FROM label_click_tokens lct
        JOIN contacts c ON c.id = lct.contact_id
        WHERE lct.used_at IS NOT NULL
          AND lct.campaign_id IS NOT NULL
          AND ca.campaign_id = lct.campaign_id
          AND ca.tenant_id = lct.tenant_id
          AND ca.recipient_email = c.email
          AND ca.status IN ('sent', 'opened')
        """
    )


def downgrade() -> None:
    # Data backfill — the pre-backfill status is not recoverable, so this is a
    # no-op rather than guessing recipients back down to 'opened'/'sent'.
    pass
