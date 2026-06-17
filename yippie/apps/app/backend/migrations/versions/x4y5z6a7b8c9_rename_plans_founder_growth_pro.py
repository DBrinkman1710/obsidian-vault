"""Rename plan tiers to founder/starter/growth/pro

Revision ID: x4y5z6a7b8c9
Revises: u1v2w3x4y5z6, w3x4y5z6a7b8, y5z6a7b8c9d0
Create Date: 2026-06-16

[PRICE1] Reworks the SaaS plan line-up. The old tiers were
free / starter / pro / enterprise; the new line-up is
founder / starter / growth / pro.

``tenants.plan`` is a plain VARCHAR (not a PostgreSQL enum), so this is a pure
data migration plus a server_default change:

  * existing 'enterprise' tenants (the backfill default) -> 'pro'
  * existing 'free' tenants                              -> 'founder'
  * server_default 'enterprise'                          -> 'founder'

'starter' is unchanged; 'pro' previously existed but no tenant was backfilled
to it, so the rename is unambiguous. This merges three open heads:
  u1v2w3x4y5z6 = add_tenant_plan
  w3x4y5z6a7b8 = contact_soft_delete
  y5z6a7b8c9d0 = tickets_composite_index (was accidentally given the same ID
                 as contact_soft_delete; corrected here)
"""
from typing import Sequence, Union

from alembic import op

revision: str = "x4y5z6a7b8c9"
down_revision: Union[str, Sequence[str], None] = ("u1v2w3x4y5z6", "w3x4y5z6a7b8", "y5z6a7b8c9d0")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Rename existing plan values. Order doesn't matter — the source values are
    # disjoint from the new names being assigned.
    op.execute("UPDATE tenants SET plan = 'pro' WHERE plan = 'enterprise'")
    op.execute("UPDATE tenants SET plan = 'founder' WHERE plan = 'free'")
    # New tenants default to the entry tier.
    op.alter_column("tenants", "plan", server_default="founder")


def downgrade() -> None:
    op.alter_column("tenants", "plan", server_default="enterprise")
    op.execute("UPDATE tenants SET plan = 'free' WHERE plan = 'founder'")
    op.execute("UPDATE tenants SET plan = 'enterprise' WHERE plan = 'pro'")
