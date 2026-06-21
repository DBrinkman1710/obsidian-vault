"""MKTG3 — Engagement score: add engagement_score column to contacts

Revision ID: 243646e386fc
Revises: b251c948a65a
Create Date: 2026-06-21

Adds engagement_score INT NOT NULL DEFAULT 0 to the contacts table.
Score is updated by the marketing service on open/click/reply/opt-out
events and decayed monthly by the scheduler.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "243646e386fc"
down_revision: Union[str, None] = "b251c948a65a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS engagement_score INTEGER NOT NULL DEFAULT 0"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE contacts DROP COLUMN IF EXISTS engagement_score")
