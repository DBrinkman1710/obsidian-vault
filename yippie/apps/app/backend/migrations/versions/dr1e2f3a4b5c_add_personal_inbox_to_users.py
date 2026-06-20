"""merge open heads after sharedinbox_001 ([DEPT-ROUTING])

Revision ID: dr1e2f3a4b5c
Revises: f7g8h9i0j1k2, sharedinbox_001, dept_members_001
Create Date: 2026-06-20

"""
from typing import Sequence, Union


revision: str = 'dr1e2f3a4b5c'
down_revision: Union[str, Sequence[str], None] = ('f7g8h9i0j1k2', 'sharedinbox_001', 'dept_members_001')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
