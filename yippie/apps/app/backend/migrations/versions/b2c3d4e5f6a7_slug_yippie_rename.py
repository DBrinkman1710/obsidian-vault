"""Rename root tenant slug from 'default' to 'yippie'

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-23

One-time rename of the root/owner tenant slug. After this migration ships,
update Railway env TENANT_ID=yippie and OWNER_SLUG=yippie.
"""
from typing import Sequence, Union

from alembic import op

revision: str = '1217c5fedede'
down_revision: Union[str, None] = '37cf6ce94373'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE tenants SET slug = 'yippie' WHERE slug = 'default'")


def downgrade() -> None:
    op.execute("UPDATE tenants SET slug = 'default' WHERE slug = 'yippie'")
