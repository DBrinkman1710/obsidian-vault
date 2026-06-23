"""merge open heads

Revision ID: 4a2953a4d504
Revises: 7aaecb9a1dbb
Create Date: 2026-06-23 09:32:56.654099

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '4a2953a4d504'
down_revision: Union[str, None] = '7aaecb9a1dbb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
