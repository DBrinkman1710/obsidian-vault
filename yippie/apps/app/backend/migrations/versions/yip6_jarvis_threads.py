"""[YIP-STREAM] jarvis_threads + jarvis_messages — server side Yip conversations;
[YIP5] tickets.sla_nudged_at — near breach nudge dedup

Revision ID: yip6_jarvis_threads
Revises: contract3_templates_signing
Create Date: 2026-07-06
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = 'yip6_jarvis_threads'
down_revision: Union[str, None] = 'contract3_templates_signing'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
    op.execute(f"""
        CREATE POLICY tenant_isolation ON {table}
            USING     (tenant_id = app_tenant_id())
            WITH CHECK (tenant_id = app_tenant_id())
    """)
    op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON {table} TO app_user")


def upgrade() -> None:
    op.create_table(
        'jarvis_threads',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(120), nullable=True),
        sa.Column('kind', sa.String(20), nullable=False, server_default='chat'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_jarvis_threads_user', 'jarvis_threads', ['tenant_id', 'user_id', 'updated_at'])
    _rls('jarvis_threads')

    op.create_table(
        'jarvis_messages',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('thread_id', UUID(as_uuid=True), sa.ForeignKey('jarvis_threads.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tenant_id', UUID(as_uuid=True), nullable=False),
        sa.Column('role', sa.String(12), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('action_taken', sa.String(32), nullable=True),
        sa.Column('inline_data', JSONB(), nullable=True),
        sa.Column('actions', JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_jarvis_messages_thread', 'jarvis_messages', ['tenant_id', 'thread_id', 'created_at'])
    _rls('jarvis_messages')

    # [YIP5] one nudge per ticket as it nears its SLA deadline
    op.add_column('tickets', sa.Column('sla_nudged_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('tickets', 'sla_nudged_at')
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON jarvis_messages")
    op.drop_index('ix_jarvis_messages_thread', table_name='jarvis_messages')
    op.drop_table('jarvis_messages')
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON jarvis_threads")
    op.drop_index('ix_jarvis_threads_user', table_name='jarvis_threads')
    op.drop_table('jarvis_threads')
