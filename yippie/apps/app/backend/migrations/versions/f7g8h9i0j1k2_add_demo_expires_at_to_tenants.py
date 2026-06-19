"""add demo_expires_at to tenants

Revision ID: f7g8h9i0j1k2
Revises: 06a08e251d50
Create Date: 2026-06-19

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f7g8h9i0j1k2"
down_revision: Union[str, None] = "06a08e251d50"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tenants",
        sa.Column("demo_expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    # Backfill existing demo tenants: 7 days from creation.
    op.execute(
        """
        UPDATE tenants
        SET demo_expires_at = created_at + interval '7 days'
        WHERE is_demo = true AND demo_expires_at IS NULL
        """
    )


def downgrade() -> None:
    op.drop_column("tenants", "demo_expires_at")
