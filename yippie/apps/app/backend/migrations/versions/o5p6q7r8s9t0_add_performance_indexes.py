"""Add performance indexes: draft_tickets ai_status + pending_sends send_at

Revision ID: o5p6q7r8s9t0
Revises: n4o5p6q7r8s9
Create Date: 2026-06-14

"""
from __future__ import annotations

from alembic import op

# revision identifiers, used by Alembic.
revision = "o5p6q7r8s9t0"
down_revision = "n4o5p6q7r8s9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # enrich_queued_drafts runs every 10s with FOR UPDATE SKIP LOCKED on ai_status='queued'
    op.create_index(
        "ix_draft_tickets_ai_status_status_created",
        "draft_tickets",
        ["ai_status", "status", "created_at"],
        unique=False,
        if_not_exists=True,
    )
    # flush_pending_sends queries send_at <= now every 5s
    op.create_index(
        "ix_pending_sends_send_at",
        "pending_sends",
        ["send_at"],
        unique=False,
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index("ix_pending_sends_send_at", table_name="pending_sends", if_exists=True)
    op.drop_index("ix_draft_tickets_ai_status_status_created", table_name="draft_tickets", if_exists=True)
