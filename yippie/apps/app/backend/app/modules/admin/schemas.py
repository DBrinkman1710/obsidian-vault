from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr

from app.config import ALL_MODULES
from app.core.plans import PlanTier


class TenantCreate(BaseModel):
    name: str
    slug: str
    admin_email: EmailStr
    # When omitted, the admin gets an invite email and sets their own password.
    admin_password: Optional[str] = None
    admin_full_name: str = "Admin"
    extra_admin_emails: list[EmailStr] = []
    enabled_modules: list[str] = ["contacts", "tickets", "billing", "activity", "inbox", "chat", "saas"]
    primary_color: str = "#5BA4F5"
    logo_url: Optional[str] = None
    is_demo: bool = False
    inbound_email: Optional[str] = None


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    enabled_modules: Optional[list[str]] = None
    plan: Optional[PlanTier] = None
    primary_color: Optional[str] = None
    logo_url: Optional[str] = None
    is_active: Optional[bool] = None
    is_demo: Optional[bool] = None
    demo_expires_at: Optional[datetime] = None
    go_live_at: Optional[datetime] = None
    inbound_email: Optional[str] = None
    kvk_nummer: Optional[str] = None
    btw_nummer: Optional[str] = None
    whatsapp_phone_number_id: Optional[str] = None
    whatsapp_access_token: Optional[str] = None
    whatsapp_verify_token: Optional[str] = None
    ai_auto_scan: Optional[bool] = None
    lead_widget_save_contact: Optional[bool] = None
    lead_widget_stage_id: Optional[uuid.UUID] = None


class TenantOut(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    enabled_modules: list[str]
    plan: str
    primary_color: str
    logo_url: Optional[str]
    is_active: bool
    is_demo: bool
    demo_expires_at: Optional[datetime]
    go_live_at: Optional[datetime]
    inbound_email: Optional[str]
    kvk_nummer: Optional[str]
    btw_nummer: Optional[str]
    whatsapp_phone_number_id: Optional[str]
    whatsapp_access_token: Optional[str]
    whatsapp_verify_token: Optional[str]
    ai_auto_scan: bool = False
    lead_widget_save_contact: bool = True
    lead_widget_stage_id: Optional[uuid.UUID] = None
    resend_domain_id: Optional[str] = None
    resend_domain_name: Optional[str] = None
    resend_domain_status: Optional[str] = None
    resend_domain_records: Optional[list] = None
    user_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class TenantUserOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    last_login_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PatchTenantUserRequest(BaseModel):
    is_active: bool


class AddAdminRequest(BaseModel):
    email: EmailStr
    # When omitted, the user gets an invite email and sets their own password.
    password: Optional[str] = None
    full_name: str = "Admin"


class PromoteSuperadminRequest(BaseModel):
    target_email: EmailStr
    current_password: str


class SuperadminOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ToggleSuperadminRequest(BaseModel):
    is_active: bool
    current_password: str


class DeleteRequest(BaseModel):
    current_password: str


class InviteSuperadminRequest(BaseModel):
    email: EmailStr
    full_name: str = "Superadmin"
    current_password: str


class BulkModuleRequest(BaseModel):
    module: str
    enabled: bool


class ProvisionDomainRequest(BaseModel):
    domain: str


class BroadcastRequest(BaseModel):
    subject: str
    body: str  # plain text; HTML wrapper applied server-side
    from_name: str = "Yippie"


class BroadcastResult(BaseModel):
    sent: int
    skipped_no_email: int
    skipped_opted_out: int
    failed: int


class TenantStatRow(BaseModel):
    tenant_id: uuid.UUID
    name: str
    slug: str
    plan: str
    is_active: bool
    tickets_open: int
    tickets_closed: int
    tickets_overdue: int
    inbox_pending: int
    contacts_created: int
    active_users_today: int
    ai_usage_today: int
    ai_usage_period: int
    saas_events_period: int = 0


class SuperAdminStatsSummary(BaseModel):
    total_tenants: int
    active_tenants: int
    total_tickets_open: int
    total_tickets_overdue: int
    total_inbox_pending: int
    total_ai_usage_today: int
    total_contacts_created: int


class SuperAdminStats(BaseModel):
    summary: SuperAdminStatsSummary
    tenants: list[TenantStatRow]
    start: datetime
    end: datetime
