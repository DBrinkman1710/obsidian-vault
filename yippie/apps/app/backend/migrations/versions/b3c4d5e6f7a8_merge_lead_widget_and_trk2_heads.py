"""merge lead widget and trk2 heads

Revision ID: b3c4d5e6f7a8
Revises: a1b2c3d4e5f0, trk2_erp_webhook_support
Create Date: 2026-06-23 00:00:01.000000

"""
from typing import Sequence, Union

revision: str = 'b3c4d5e6f7a8'
down_revision: Union[str, Sequence[str], None] = ('a1b2c3d4e5f0', 'trk2_erp_webhook_support')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
