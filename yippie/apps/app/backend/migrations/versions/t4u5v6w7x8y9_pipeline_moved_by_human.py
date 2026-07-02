"""Add moved_by_human flag to contact_pipeline_entries

Revision ID: t4u5v6w7x8y9
Revises: s3t4u5v6w7x8
Create Date: 2026-07-02

Lets automation (ERP webhook, bookings) know whether a human explicitly
placed a contact in a stage. When True, automated stage moves are skipped.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 't4u5v6w7x8y9'
down_revision: Union[str, Sequence[str], None] = 's3t4u5v6w7x8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'contact_pipeline_entries',
        sa.Column('moved_by_human', sa.Boolean(), nullable=False, server_default='false'),
    )


def downgrade() -> None:
    op.drop_column('contact_pipeline_entries', 'moved_by_human')
