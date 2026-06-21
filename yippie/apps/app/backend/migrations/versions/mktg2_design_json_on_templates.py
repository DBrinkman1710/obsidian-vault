"""add design_json and campaign_buttons to campaign_templates

Revision ID: mktg2_design_json_on_templates
Revises: tc2d3e4f5g6h
Create Date: 2026-06-21

Adds GrapesJS visual-editor fields to campaign_templates so the Marketing
template editor uses the same GrapesEditor (yippie-button + yippie-signature
blocks) and full-screen popup as the response Templates page.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'mktg2_design_json_on_templates'
down_revision: Union[str, None] = 'tc2d3e4f5g6h'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE campaign_templates ADD COLUMN IF NOT EXISTS design_json TEXT")
    op.execute("ALTER TABLE campaign_templates ADD COLUMN IF NOT EXISTS campaign_buttons TEXT")


def downgrade() -> None:
    op.execute("ALTER TABLE campaign_templates DROP COLUMN IF EXISTS campaign_buttons")
    op.execute("ALTER TABLE campaign_templates DROP COLUMN IF EXISTS design_json")
