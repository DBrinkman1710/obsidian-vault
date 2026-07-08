from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class TeamMemberOut(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str

    model_config = {"from_attributes": True}


class TeamUserOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    last_login_at: Optional[datetime]

    model_config = {"from_attributes": True}


class TeamInviteRequest(BaseModel):
    email: EmailStr
    full_name: str
    role: str = "agent"  # agent | admin | viewer
    rbac_role_ids: list[uuid.UUID] = []


class TeamUserUpdate(BaseModel):
    is_active: Optional[bool] = None
    role: Optional[str] = None  # agent | admin | viewer
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None


class BrandingUpdate(BaseModel):
    primary_color: str
    # Optional logo URL. Omitted (None) leaves the current logo untouched;
    # pass an empty string to clear it.
    logo_url: Optional[str] = None


class OrgSettingsUpdate(BaseModel):
    kvk_nummer: Optional[str] = None
    btw_nummer: Optional[str] = None


class OrgSettingsOut(BaseModel):
    kvk_nummer: Optional[str] = None
    btw_nummer: Optional[str] = None


class UserDepartmentOut(BaseModel):
    id: uuid.UUID
    name: str

    model_config = {"from_attributes": True}


class UserDepartmentsUpdate(BaseModel):
    department_ids: list[uuid.UUID] = []


class AiProfileUpdate(BaseModel):
    business_description: Optional[str] = None
    tone: Optional[str] = None
    reply_language: Optional[str] = None
    sign_off: Optional[str] = None
    common_terms: Optional[str] = None
    faq_context: Optional[str] = None
