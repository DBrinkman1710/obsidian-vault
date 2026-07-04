"""merge users-email-ci-unique and assistant-memories heads

Both branched off ps1_pending_send_attempts in parallel sessions.

Revision ID: m2_merge_email_ci_and_yip
Revises: ps2_users_email_ci_unique, yip1_assistant_memories
Create Date: 2026-07-04

"""
from __future__ import annotations

from typing import Sequence, Union

revision: str = 'm2_merge_email_ci_and_yip'
down_revision: Union[str, Sequence[str], None] = ('ps2_users_email_ci_unique', 'yip1_assistant_memories')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
