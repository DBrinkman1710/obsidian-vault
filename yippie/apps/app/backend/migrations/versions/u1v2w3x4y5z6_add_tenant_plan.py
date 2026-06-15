"""Add Tenant.plan column for SaaS plan-tier feature gating

Revision ID: u1v2w3x4y5z6
Revises: t0u1v2w3x4y5
Create Date: 2026-06-15

Adds a ``plan`` column to ``tenants`` carrying the tenant's own Yippie
subscription tier (free / starter / pro / enterprise). The plan gates advanced
features on top of the existing enabled_modules system (see app.core.plans).

No RLS policy is added here: ``tenants`` is the tenant table itself and is not
covered by the per-tenant tenant_isolation policy (superadmins read it across
tenants via RESET ROLE).

Existing tenants are backfilled to 'enterprise' via the server_default so that
introducing gating never locks anyone out of a feature they use today.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "u1v2w3x4y5z6"
down_revision: Union[str, None] = "t0u1v2w3x4y5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # server_default backfills every existing row to 'enterprise' in one statement.
    op.add_column(
        "tenants",
        sa.Column("plan", sa.String(length=20), nullable=False, server_default="enterprise"),
    )


def downgrade() -> None:
    op.drop_column("tenants", "plan")
