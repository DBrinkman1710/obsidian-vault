"""Merge BK chain head (c9d0e1f2g3h4) with rename_plans head (x4y5z6a7b8c9)

Revision ID: d2e3f4a5b6c7
Revises: c9d0e1f2g3h4, x4y5z6a7b8c9
Create Date: 2026-06-16

No-op merge migration. The BK5/6/7 chain branched off y5z6a7b8c9d0
independently of the rename_plans merge (x4y5z6a7b8c9), producing two
heads in alembic_version. This migration consolidates them into one.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'd2e3f4a5b6c7'
down_revision: Union[str, Sequence[str], None] = ('c9d0e1f2g3h4', 'x4y5z6a7b8c9')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
