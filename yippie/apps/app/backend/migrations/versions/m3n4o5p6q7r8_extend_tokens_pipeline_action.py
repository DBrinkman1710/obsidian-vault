"""Extend label_click_tokens with action_type and stage_id for pipeline support

Revision ID: m3n4o5p6q7r8
Revises: l2m3n4o5p6q7
Create Date: 2026-06-13

"""
from typing import Sequence, Union

from alembic import op

revision: str = 'm3n4o5p6q7r8'
down_revision: Union[str, None] = 'l2m3n4o5p6q7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE label_click_tokens ADD COLUMN IF NOT EXISTS action_type VARCHAR(20) NOT NULL DEFAULT 'label'")
    op.execute("ALTER TABLE label_click_tokens ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES pipeline_stages(id) ON DELETE CASCADE")
    op.execute("ALTER TABLE label_click_tokens ALTER COLUMN label_id DROP NOT NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE label_click_tokens ALTER COLUMN label_id SET NOT NULL")
    op.execute("ALTER TABLE label_click_tokens DROP COLUMN IF EXISTS stage_id")
    op.execute("ALTER TABLE label_click_tokens DROP COLUMN IF EXISTS action_type")
