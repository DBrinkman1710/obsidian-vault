"""add tenant config columns (enabled_modules, branding)

Revision ID: f2e3d4c5b6a7
Revises: e1f2a3b4c5d6
Create Date: 2026-06-03

"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = 'f2e3d4c5b6a7'
down_revision: Union[str, None] = 'e1f2a3b4c5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_ALL_MODULES = ['contacts', 'tickets', 'billing', 'activity', 'inbox', 'chat']


def upgrade() -> None:
    op.add_column('tenants', sa.Column(
        'enabled_modules',
        postgresql.ARRAY(sa.String()),
        nullable=False,
        server_default='{' + ','.join(_ALL_MODULES) + '}',
    ))
    op.add_column('tenants', sa.Column(
        'primary_color', sa.String(20), nullable=False, server_default='#5BB8E8'
    ))
    op.add_column('tenants', sa.Column(
        'logo_url', sa.String(500), nullable=True
    ))


def downgrade() -> None:
    op.drop_column('tenants', 'logo_url')
    op.drop_column('tenants', 'primary_color')
    op.drop_column('tenants', 'enabled_modules')
