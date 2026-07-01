"""add ai_profile to tenants

Revision ID: g2h3i4j5k6l7
Revises: f1a2b3c4d5e6
Create Date: 2026-06-30

Adds a nullable JSONB column `ai_profile` to the tenants table.
Keys: business_description, tone, reply_language, sign_off, common_terms, faq_context.
Set via the Yip training conversation (POST /jarvis/train) or Settings -> AI & Yip.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'g2h3i4j5k6l7'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'tenants',
        sa.Column('ai_profile', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('tenants', 'ai_profile')
