"""merge lowercase_contact_emails and chat_message_media_fields heads

Revision ID: a3b4c5d6e7f8
Revises: a2b3c4d5e6f7, lm7n8o9p0q1r
Create Date: 2026-06-21

"""
from typing import Sequence, Union

revision: str = 'a3b4c5d6e7f8'
down_revision: Union[str, Sequence[str], None] = ('a2b3c4d5e6f7', 'lm7n8o9p0q1r')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
