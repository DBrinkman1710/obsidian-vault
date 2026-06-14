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
