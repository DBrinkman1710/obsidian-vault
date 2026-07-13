"""thank you tags — draft reject reason + ticket thank_you, for first time right

Revision ID: act2_thankyou_tags
Revises: act2_draft_opened_by
Create Date: 2026-07-13

[ACTIVITY2] first time right refinement. draft_tickets.reject_reason labels
why a draft was rejected at triage (thank_you|spam|duplicate|no_action);
tickets.thank_you marks a close as "just a thank you" so it is excluded from
the FTR denominator. Idempotent ADD COLUMN IF NOT EXISTS for sandbox drift.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'act2_thankyou_tags'
down_revision: Union[str, Sequence[str], None] = 'act2_draft_opened_by'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE draft_tickets ADD COLUMN IF NOT EXISTS reject_reason VARCHAR(20)")
    op.execute("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS thank_you BOOLEAN NOT NULL DEFAULT false")


def downgrade() -> None:
    op.drop_column('tickets', 'thank_you')
    op.drop_column('draft_tickets', 'reject_reason')
