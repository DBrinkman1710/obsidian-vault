from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class TenantCreate(BaseModel):
    name: str
    slug: str
    admin_email: EmailStr
    admin_password: str
    enabled_modules: list[str] = ["contacts", "tickets", "billing", "activity", "inbox", "chat"]
    primary_color: str = "#5BB8E8"
    logo_url: Optional[str] = None


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    enabled_modules: Optional[list[str]] = None
    primary_color: Optional[str] = None
    logo_url: Optional[str] = None


class TenantOut(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    enabled_modules: list[str]
    primary_color: str
    logo_url: Optional[str]
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
