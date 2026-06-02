"""add department_id to tickets

Revision ID: a1b2c3d4e5f6
Revises: f43013171b86
Create Date: 2026-06-02 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f43013171b86'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tickets', sa.Column('department_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        'fk_tickets_department_id', 'tickets', 'departments', ['department_id'], ['id']
    )


def downgrade() -> None:
    op.drop_constraint('fk_tickets_department_id', 'tickets', type_='foreignkey')
    op.drop_column('tickets', 'department_id')
