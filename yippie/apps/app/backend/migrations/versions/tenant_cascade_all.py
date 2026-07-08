"""tenant_cascade_all — cascade all tenant_id columns to tenants(id)

Every table that has a tenant_id column now carries a proper FK to
tenants(id) ON DELETE CASCADE. Deleting a tenant row lets PostgreSQL
cascade the wipe automatically, so application code no longer needs to
maintain a hand-rolled table order.

The upgrade uses information_schema to discover tables at run time, so
it is immune to the list going stale as new tables are added.

Revision ID: tenant_cascade_all
Revises: req1_booking_requests
Create Date: 2026-07-08
"""
from alembic import op

revision: str = "tenant_cascade_all"
down_revision: str = "req1_booking_requests"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Single DO block — discovered dynamically so no table list to maintain.
    #
    # Part A: tables with tenant_id but NO FK to tenants yet.
    #   1. Purge orphaned rows (tenant_id pointing to a deleted tenant).
    #   2. Add FK with ON DELETE CASCADE.
    #
    # Part B: tables that already have a FK to tenants but without CASCADE.
    #   Drop the old constraint and recreate it with ON DELETE CASCADE.
    op.execute("""
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Part A: add CASCADE FK to tables that have tenant_id but no FK yet
    FOR r IN (
        SELECT c.table_name
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.column_name  = 'tenant_id'
          AND c.table_name  != 'tenants'
          AND c.table_name NOT IN (
              SELECT kcu.table_name
              FROM information_schema.table_constraints   tc
              JOIN information_schema.key_column_usage    kcu ON tc.constraint_name  = kcu.constraint_name
                                                              AND tc.table_schema     = kcu.table_schema
              JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
                                                                 AND tc.table_schema   = rc.constraint_schema
              JOIN information_schema.table_constraints   tc2 ON rc.unique_constraint_name   = tc2.constraint_name
                                                               AND rc.unique_constraint_schema = tc2.table_schema
              WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc2.table_name     = 'tenants'
                AND kcu.column_name    = 'tenant_id'
                AND tc.table_schema    = 'public'
          )
        ORDER BY c.table_name
    )
    LOOP
        EXECUTE format(
            'DELETE FROM %I WHERE tenant_id NOT IN (SELECT id FROM tenants)',
            r.table_name
        );
        EXECUTE format(
            'ALTER TABLE %I ADD CONSTRAINT %I '
            'FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE',
            r.table_name,
            r.table_name || '_tenant_fk'
        );
    END LOOP;

    -- Part B: upgrade existing FKs that lack ON DELETE CASCADE
    FOR r IN (
        SELECT kcu.table_name, tc.constraint_name
        FROM information_schema.table_constraints        tc
        JOIN information_schema.key_column_usage         kcu ON tc.constraint_name  = kcu.constraint_name
                                                             AND tc.table_schema     = kcu.table_schema
        JOIN information_schema.referential_constraints  rc  ON tc.constraint_name  = rc.constraint_name
                                                             AND tc.table_schema     = rc.constraint_schema
        JOIN information_schema.table_constraints        tc2 ON rc.unique_constraint_name   = tc2.constraint_name
                                                             AND rc.unique_constraint_schema = tc2.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc2.table_name     = 'tenants'
          AND kcu.column_name    = 'tenant_id'
          AND rc.delete_rule    != 'CASCADE'
          AND tc.table_schema    = 'public'
        ORDER BY kcu.table_name
    )
    LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',
                       r.table_name, r.constraint_name);
        EXECUTE format(
            'ALTER TABLE %I ADD CONSTRAINT %I '
            'FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE',
            r.table_name, r.constraint_name
        );
    END LOOP;
END $$;
""")


def downgrade() -> None:
    op.execute("""
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN (
        SELECT tc.constraint_name, kcu.table_name
        FROM information_schema.table_constraints        tc
        JOIN information_schema.key_column_usage         kcu ON tc.constraint_name  = kcu.constraint_name
                                                             AND tc.table_schema     = kcu.table_schema
        JOIN information_schema.referential_constraints  rc  ON tc.constraint_name  = rc.constraint_name
                                                             AND tc.table_schema     = rc.constraint_schema
        JOIN information_schema.table_constraints        tc2 ON rc.unique_constraint_name   = tc2.constraint_name
                                                             AND rc.unique_constraint_schema = tc2.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc2.table_name     = 'tenants'
          AND kcu.column_name    = 'tenant_id'
          AND rc.delete_rule     = 'CASCADE'
          AND tc.table_schema    = 'public'
          AND tc.constraint_name LIKE '%_tenant_fk'
    )
    LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',
                       r.table_name, r.constraint_name);
    END LOOP;
END $$;
""")
