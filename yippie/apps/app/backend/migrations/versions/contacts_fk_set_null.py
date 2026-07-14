"""contacts_fk_set_null — SET NULL on all nullable FKs referencing contacts(id)

Deleting a tenant cascades fine via the tenant_id FKs, but the superadmin
demo cleanup path (admin/service.py) deletes the lead *contact* directly from
the root owner's own pipeline. Several tables reference contacts(id) with a
plain FK (no ON DELETE rule), so that direct delete raised a
ForeignKeyViolationError (e.g. activity_events_contact_id_fkey).

This migration converts every FK that references contacts(id) whose referencing
column is NULLABLE and currently has delete_rule = NO ACTION into
ON DELETE SET NULL. Nullable audit/reference columns keep their row and simply
lose the contact link. NOT NULL FKs (e.g. billing) are left untouched — those
should block a delete loudly rather than silently orphan.

Discovered dynamically via information_schema so it stays correct as new tables
are added.

Revision ID: contacts_fk_set_null
Revises: act2_thankyou_tags
Create Date: 2026-07-14
"""
from alembic import op

revision: str = "contacts_fk_set_null"
down_revision: str = "act2_thankyou_tags"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tc.constraint_name,
               kcu.table_name,
               kcu.column_name
        FROM information_schema.table_constraints        tc
        JOIN information_schema.key_column_usage         kcu ON tc.constraint_name  = kcu.constraint_name
                                                             AND tc.table_schema     = kcu.table_schema
        JOIN information_schema.referential_constraints  rc  ON tc.constraint_name  = rc.constraint_name
                                                             AND tc.table_schema     = rc.constraint_schema
        JOIN information_schema.table_constraints        tc2 ON rc.unique_constraint_name   = tc2.constraint_name
                                                             AND rc.unique_constraint_schema = tc2.table_schema
        JOIN information_schema.columns                  col ON col.table_schema = kcu.table_schema
                                                             AND col.table_name   = kcu.table_name
                                                             AND col.column_name  = kcu.column_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc2.table_name     = 'contacts'
          AND rc.delete_rule     = 'NO ACTION'
          AND col.is_nullable    = 'YES'
          AND tc.table_schema    = 'public'
    )
    LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',
                       r.table_name, r.constraint_name);
        EXECUTE format(
            'ALTER TABLE %I ADD CONSTRAINT %I '
            'FOREIGN KEY (%I) REFERENCES contacts(id) ON DELETE SET NULL',
            r.table_name, r.constraint_name, r.column_name
        );
    END LOOP;
END $$;
""")


def downgrade() -> None:
    op.execute("""
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tc.constraint_name,
               kcu.table_name,
               kcu.column_name
        FROM information_schema.table_constraints        tc
        JOIN information_schema.key_column_usage         kcu ON tc.constraint_name  = kcu.constraint_name
                                                             AND tc.table_schema     = kcu.table_schema
        JOIN information_schema.referential_constraints  rc  ON tc.constraint_name  = rc.constraint_name
                                                             AND tc.table_schema     = rc.constraint_schema
        JOIN information_schema.table_constraints        tc2 ON rc.unique_constraint_name   = tc2.constraint_name
                                                             AND rc.unique_constraint_schema = tc2.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc2.table_name     = 'contacts'
          AND rc.delete_rule     = 'SET NULL'
          AND tc.table_schema    = 'public'
    )
    LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',
                       r.table_name, r.constraint_name);
        EXECUTE format(
            'ALTER TABLE %I ADD CONSTRAINT %I '
            'FOREIGN KEY (%I) REFERENCES contacts(id)',
            r.table_name, r.constraint_name, r.column_name
        );
    END LOOP;
END $$;
""")
