"""extend tenants.logo_url from String(500) to Text for base64 data URLs

Revision ID: a3f8c2e91b4d
Revises: flows10_sla_stepwise_restore
Create Date: 2026-07-10

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'a3f8c2e91b4d'
down_revision: Union[str, Sequence[str], None] = 'flows10_sla_stepwise_restore'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "tenants",
        "logo_url",
        type_=sa.Text(),
        existing_type=sa.String(500),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "tenants",
        "logo_url",
        type_=sa.String(500),
        existing_type=sa.Text(),
        existing_nullable=True,
    )
