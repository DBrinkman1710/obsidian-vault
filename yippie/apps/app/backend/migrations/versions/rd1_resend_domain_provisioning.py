"""add resend domain provisioning columns to tenants

Revision ID: rd1_resend_domain_provisioning
Revises: ob1c2d3e4f5g
Create Date: 2026-06-23

"""
from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = 'rd1_resend_domain_provisioning'
down_revision: Union[str, None] = 'ob1c2d3e4f5g'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('tenants', sa.Column('resend_domain_id', sa.String(100), nullable=True))
    op.add_column('tenants', sa.Column('resend_domain_name', sa.String(255), nullable=True))
    op.add_column('tenants', sa.Column('resend_domain_status', sa.String(50), nullable=True))
    op.add_column('tenants', sa.Column('resend_domain_records', JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column('tenants', 'resend_domain_records')
    op.drop_column('tenants', 'resend_domain_status')
    op.drop_column('tenants', 'resend_domain_name')
    op.drop_column('tenants', 'resend_domain_id')
