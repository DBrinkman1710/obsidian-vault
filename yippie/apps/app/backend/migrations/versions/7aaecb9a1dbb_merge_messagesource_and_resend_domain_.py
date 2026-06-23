"""merge messagesource and resend domain heads

Revision ID: 7aaecb9a1dbb
Revises: p7q8r9s0t1u2, rd1_resend_domain_provisioning
Create Date: 2026-06-23 09:27:36.779931

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '7aaecb9a1dbb'
down_revision: Union[str, None] = ('p7q8r9s0t1u2', 'rd1_resend_domain_provisioning')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
