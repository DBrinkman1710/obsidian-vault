"""lang1 add ui_language to users

Revision ID: lang1_ui_language
Revises: stripe1b_add_stripe_cols_heal
Create Date: 2026-06-23

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = 'lang1_ui_language'
down_revision: Union[str, None] = 'stripe1b_add_stripe_cols_heal'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column(
        'ui_language', sa.String(10), nullable=False, server_default='en'
    ))


def downgrade() -> None:
    op.drop_column('users', 'ui_language')
