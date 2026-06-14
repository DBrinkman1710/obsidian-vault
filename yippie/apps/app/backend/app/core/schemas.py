from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr

from app.core.models import UserRole


class UserOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    email: str
    full_name: str
    role: UserRole
    reply_from_email: Optional[str] = None
    inbound_email: Optional[str] = None
    email_signature: Optional[str] = None
    hotkeys_enabled: bool = True
    contact_column_prefs: Optional[list[dict]] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TenantConfigOut(BaseModel):
    tenant_id: str
    tenant_name: str
    enabled_modules: list[str]
    branding: dict
    environment: str = "production"
    is_demo: bool = False
    is_active: bool = True
