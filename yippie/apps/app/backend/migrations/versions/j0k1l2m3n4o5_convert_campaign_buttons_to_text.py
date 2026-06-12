"""convert campaign_buttons from JSONB to TEXT

Revision ID: j0k1l2m3n4o5
Revises: i9j0k1l2m3n4
Create Date: 2026-06-12

Migration g7h8i9j0k1l2 created campaign_buttons as JSONB, but the SQLAlchemy model
declares it as Text. asyncpg decodes JSONB back to a Python list on read, which
causes a Pydantic validation error in TemplateOut (campaign_buttons: str | None).
Cast to TEXT so the column type matches the model.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'j0k1l2m3n4o5'
down_revision: Union[str, None] = 'i9j0k1l2m3n4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE response_templates
        ALTER COLUMN campaign_buttons TYPE TEXT
        USING campaign_buttons::TEXT
    """)
    op.execute("""
        ALTER TABLE response_templates
        ALTER COLUMN campaign_buttons SET DEFAULT '[]'
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE response_templates
        ALTER COLUMN campaign_buttons TYPE JSONB
        USING campaign_buttons::JSONB
    """)
    op.execute("""
        ALTER TABLE response_templates
        ALTER COLUMN campaign_buttons SET DEFAULT '[]'
    """)
