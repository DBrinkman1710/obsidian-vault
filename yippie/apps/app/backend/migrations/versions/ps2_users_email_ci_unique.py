"""lowercase user emails and enforce case-insensitive uniqueness

Login matches on lower(email) but registration/creation paths used to compare
case-sensitively, so 'Foo@x.com' and 'foo@x.com' could both exist — after which
login's scalar_one_or_none() raises MultipleResultsFound (a 500) for both users.
All write paths now lowercase; this backfills existing rows and adds the index
that makes the invariant a hard guarantee.

Revision ID: ps2_users_email_ci_unique
Revises: ps1_pending_send_attempts
Create Date: 2026-07-04

"""
from alembic import op
import sqlalchemy as sa

revision: str = 'ps2_users_email_ci_unique'
down_revision = 'ps1_pending_send_attempts'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Fails loudly (unique violation) if two rows differ only by case — that is
    # a data conflict that needs a human decision, not silent merging.
    op.execute("UPDATE users SET email = lower(email) WHERE email <> lower(email)")
    op.create_index(
        'ux_users_email_lower',
        'users',
        [sa.text('lower(email)')],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index('ux_users_email_lower', table_name='users')
