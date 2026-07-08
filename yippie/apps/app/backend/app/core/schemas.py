from __future__ import annotations

import os
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, model_validator

from app.core.models import UserRole


class UserOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    email: str
    full_name: str
    role: UserRole
    is_root_owner: bool = False
    reply_from_email: Optional[str] = None
    inbound_email: Optional[str] = None
    email_signature: Optional[str] = None
    hotkeys_enabled: bool = True
    shared_inbox_disabled: bool = False
    contact_column_prefs: Optional[list[dict]] = None
    sidebar_order: Optional[list[str]] = None
    send_from_aliases: Optional[list[str]] = None
    tour_completed: bool = False
    setup_checklist_dismissed: bool = False
    ui_language: str = "en"
    jarvis_prefs: Optional[dict] = None
    help_tips_enabled: bool = True
    created_at: datetime

    model_config = {"from_attributes": True}

    @model_validator(mode="after")
    def _set_root_owner(self) -> "UserOut":
        protected = os.getenv("ADMIN_EMAIL", "").lower()
        if protected:
            self.is_root_owner = self.email.lower() == protected
        return self


class SignatureOut(BaseModel):
    id: uuid.UUID
    name: str
    body: str
    is_default: bool
    display_order: int

    model_config = {"from_attributes": True}


# Inline base64 image cap (S2): 500 KB of decoded bytes. Base64 inflates ~4/3,
# so the encoded data-URI in the body can be up to ~680 KB of text; we validate
# the whole body length generously below.
MAX_SIGNATURE_BODY_CHARS = 800_000


class SignatureCreate(BaseModel):
    name: str
    body: str = ""


class SignatureUpdate(BaseModel):
    name: Optional[str] = None
    body: Optional[str] = None
    is_default: Optional[bool] = None
    display_order: Optional[int] = None


class TenantConfigOut(BaseModel):
    tenant_id: str
    tenant_name: str
    enabled_modules: list[str]
    branding: dict
    environment: str = "production"
    is_demo: bool = False
    is_active: bool = True
    # [TRIAL30] When set, the tenant is on a free trial — the frontend renders
    # the trial countdown banner with an upgrade CTA. ISO datetime string.
    trial_ends_at: Optional[datetime] = None
    # Tenant's SaaS plan tier and the feature set it unlocks. The frontend gates
    # a feature only when it is in BOTH enabled_modules AND allowed_features.
    plan: str = "pro"
    allowed_features: list[str] = []
    # Seat/contact caps for the tenant's plan (None == unlimited) and the
    # à la carte module add-on prices (euros/month), surfaced for in-app upsell.
    plan_limits: dict = {}
    module_prices: dict = {}
    # When False (default) the inbox AI never runs automatically — agents click
    # Generate per draft. True restores auto-scan-on-arrival.
    ai_auto_scan: bool = False
    # Stripe — surfaced so the frontend can show subscription status + usage bar.
    stripe_subscription_status: str | None = None
    stripe_publishable_key: str = ""
    ai_scans_used_this_period: int = 0
    # Tenant's tracking token — always present, used to auto-embed the saas.js
    # snippet in every Yippie environment for internal platform usage tracking.
    tracking_token: str | None = None
    # AI profile — set via Yip training or Settings -> AI & Yip.
    ai_profile: dict | None = None
