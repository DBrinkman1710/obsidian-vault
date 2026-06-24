"""add redirect_url to label_click_tokens for campaign button post-click redirect

Revision ID: e6460a87b052
Revises: 1217c5fedede
Create Date: 2026-06-24

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'e6460a87b052'
down_revision: Union[str, Sequence[str], None] = '1217c5fedede'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('label_click_tokens', sa.Column('redirect_url', sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column('label_click_tokens', 'redirect_url')
