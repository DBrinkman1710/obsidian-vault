"""merge open heads

Revision ID: 4a2953a4d504
Revises: p7q8r9s0t1u2, rd1_resend_domain_provisioning
Create Date: 2026-06-23 09:32:56.654099

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '4a2953a4d504'
down_revision: Union[str, None] = ('p7q8r9s0t1u2', 'rd1_resend_domain_provisioning')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
