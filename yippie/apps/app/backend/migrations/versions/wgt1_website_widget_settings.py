"""[WGT1] website widget settings — embeddable lead + booking widgets

Revision ID: wgt1_website_widget_settings
Revises: inv2_invoice_compliance
Create Date: 2026-07-31

The lead widget hardcoded its own blue and button label, so a client site could
not match it to the tenant's branding without editing the script. These columns
move that into tenant config, served to the widgets at runtime via
GET /api/v1/public/widget-config/{slug} — so changing the styling updates every
embedding site without anyone re-pasting the snippet.

booking_widget_* backs the new booking-widget.js, which wraps the existing
public /meet/{slug} slot API that until now had no embeddable front end.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "wgt1_website_widget_settings"
down_revision: Union[str, Sequence[str], None] = "inv2_invoice_compliance"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE tenants
            ADD COLUMN IF NOT EXISTS widget_accent_color        VARCHAR(20),
            ADD COLUMN IF NOT EXISTS lead_widget_enabled        BOOLEAN NOT NULL DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS lead_widget_button_text    VARCHAR(60),
            ADD COLUMN IF NOT EXISTS lead_widget_heading        VARCHAR(80),
            ADD COLUMN IF NOT EXISTS booking_widget_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS booking_widget_button_text VARCHAR(60),
            ADD COLUMN IF NOT EXISTS booking_widget_heading     VARCHAR(80)
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE tenants
            DROP COLUMN IF EXISTS booking_widget_heading,
            DROP COLUMN IF EXISTS booking_widget_button_text,
            DROP COLUMN IF EXISTS booking_widget_enabled,
            DROP COLUMN IF EXISTS lead_widget_heading,
            DROP COLUMN IF EXISTS lead_widget_button_text,
            DROP COLUMN IF EXISTS lead_widget_enabled,
            DROP COLUMN IF EXISTS widget_accent_color
        """
    )
