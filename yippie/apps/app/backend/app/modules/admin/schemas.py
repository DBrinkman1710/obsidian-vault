from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class TenantCreate(BaseModel):
    name: str
    slug: str
    admin_email: EmailStr
    # When omitted, the admin gets an invite email and sets their own password.
    admin_password: Optional[str] = None
    admin_full_name: str = "Admin"
    extra_admin_emails: list[EmailStr] = []
    enabled_modules: list[str] = ["contacts", "tickets", "billing", "activity", "inbox", "chat"]
    primary_color: str = "#5BB8E8"
    logo_url: Optional[str] = None
    is_demo: bool = False


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    enabled_modules: Optional[list[str]] = None
    primary_color: Optional[str] = None
    logo_url: Optional[str] = None
    is_active: Optional[bool] = None
    is_demo: Optional[bool] = None
    go_live_at: Optional[datetime] = None
    inbound_email: Optional[str] = None


class TenantOut(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    enabled_modules: list[str]
    primary_color: str
    logo_url: Optional[str]
    is_active: bool
    is_demo: bool
    go_live_at: Optional[datetime]
    inbound_email: Optional[str]
    user_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class TenantUserOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


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
