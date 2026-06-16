"""SENT2 — add body column to outbound_emails

Revision ID: c9d0e1f2g3h4
Revises: b8c9d0e1f2g3
Create Date: 2026-06-16

Stores the plain-text body of each sent email so it can be
displayed when a user clicks a sent mail in the Sent tab.
Nullable so existing rows are not affected.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'c9d0e1f2g3h4'
down_revision: Union[str, None] = 'b8c9d0e1f2g3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'outbound_emails',
        sa.Column('body', sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('outbound_emails', 'body')
