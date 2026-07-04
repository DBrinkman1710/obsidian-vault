"""[YIP1] Add assistant_memories — durable per user facts for the Yip agent

Revision ID: yip1_assistant_memories
Revises: bk9_min_notice_days
Create Date: 2026-07-04
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = 'yip1_assistant_memories'
down_revision: Union[str, None] = 'bk9_min_notice_days'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'assistant_memories',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tenant_id', UUID(as_uuid=True), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_assistant_memories_user', 'assistant_memories', ['tenant_id', 'user_id'])

    op.execute("ALTER TABLE assistant_memories ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE assistant_memories FORCE ROW LEVEL SECURITY")
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON assistant_memories")
    op.execute("""
        CREATE POLICY tenant_isolation ON assistant_memories
            USING     (tenant_id = app_tenant_id())
            WITH CHECK (tenant_id = app_tenant_id())
    """)
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON assistant_memories TO app_user")


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON assistant_memories")
    op.drop_index('ix_assistant_memories_user', table_name='assistant_memories')
    op.drop_table('assistant_memories')
