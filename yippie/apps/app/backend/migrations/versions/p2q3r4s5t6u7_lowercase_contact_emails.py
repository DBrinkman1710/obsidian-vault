"""lowercase all contact emails

Revision ID: p2q3r4s5t6u7
Revises: lm7n8o9p0q1r
Create Date: 2026-06-21

"""
from typing import Sequence, Union
from alembic import op

revision: str = 'p2q3r4s5t6u7'
down_revision: Union[str, Sequence[str], None] = 'lm7n8o9p0q1r'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE contacts SET email = LOWER(email) WHERE email IS NOT NULL AND email != LOWER(email)")


def downgrade() -> None:
    pass
