"""access_locked_at on tenants — lock lapsed trials instead of deactivating

Revision ID: acclock1_access_locked_at
Revises: yipkb1_knowledge_base
Create Date: 2026-09-07

A lapsed trial/subscription no longer deactivates the tenant (login stays
working). Instead access_locked_at is stamped: the tenant stays active but the
app is walled behind the subscribe modal (config exposes subscription_required,
module APIs return 402, while auth/tenant-config/Stripe stay open so they can
pay). subscription_required is derived from this column.

One time data heal: reactivate tenants that were deactivated purely by trial
expiry, so they can log in and hit the new modal instead of being locked out.

Written defensively (IF NOT EXISTS) because this DB has known schema drift — a
partially applied or re-run deploy must never abort.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "acclock1_access_locked_at"
down_revision: Union[str, Sequence[str], None] = "yipkb1_knowledge_base"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS access_locked_at TIMESTAMPTZ"
    )
    # One time heal: tenants that trial_expiry_check previously deactivated get
    # reactivated and stamped locked, so login works and they see the subscribe
    # modal. Scoped to non demo, still trial expired, unconverted tenants only.
    op.execute(
        """
        UPDATE tenants
        SET is_active = true, access_locked_at = now()
        WHERE is_active = false
          AND is_demo = false
          AND trial_ends_at IS NOT NULL
          AND trial_ends_at < now()
          AND go_live_at IS NULL
          AND (stripe_subscription_status IS NULL
               OR stripe_subscription_status NOT IN ('active', 'trialing'))
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE tenants DROP COLUMN IF EXISTS access_locked_at")
