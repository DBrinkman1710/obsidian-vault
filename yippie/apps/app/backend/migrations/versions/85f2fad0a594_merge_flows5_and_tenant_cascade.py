"""merge flows5 and tenant cascade

Revision ID: 85f2fad0a594
Revises: flows5_webhooks, tenant_cascade_all
Create Date: 2026-07-08 15:56:30.747635

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '85f2fad0a594'
down_revision: Union[str, None] = ('flows5_webhooks', 'tenant_cascade_all')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
