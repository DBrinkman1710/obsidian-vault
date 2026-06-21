"""lowercase all contact emails

Revision ID: a2b3c4d5e6f7
Revises: 243646e386fc, mktg2_design_json_on_templates
Create Date: 2026-06-21

"""
from typing import Sequence, Union
from alembic import op

revision: str = 'a2b3c4d5e6f7'
down_revision: Union[str, Sequence[str], None] = ('243646e386fc', 'mktg2_design_json_on_templates')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE contacts SET email = LOWER(email) WHERE email IS NOT NULL AND email != LOWER(email)")


def downgrade() -> None:
    pass
