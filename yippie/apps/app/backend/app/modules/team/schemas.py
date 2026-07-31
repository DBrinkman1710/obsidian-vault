from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


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


class WorkspacePrefsUpdate(BaseModel):
    # Pipeline staleness sidebar dot ([UX-PSYCH] nudge). None leaves it untouched.
    pipeline_nudge_enabled: Optional[bool] = None
    # Shared inbox receiving address on the Yippie domain. None leaves it
    # untouched; "" clears it back to the domain default.
    inbound_email: Optional[str] = None


class WorkspacePrefsOut(BaseModel):
    pipeline_nudge_enabled: bool
    inbound_email: Optional[str] = None


class OrgSettingsOut(BaseModel):
    kvk_nummer: Optional[str] = None
    btw_nummer: Optional[str] = None


class WidgetSettingsOut(BaseModel):
    """[WGT1] Website widget config plus the ready to paste embed snippets.

    Readable by any signed in member so they can copy a snippet; only admins may
    PATCH it (see the router).
    """

    tenant_slug: str
    accent_color: str
    lead_widget_enabled: bool = True
    lead_widget_button_text: str = "Get in touch"
    lead_widget_heading: str = "Contact us"
    booking_widget_enabled: bool = True
    booking_widget_button_text: str = "Book a meeting"
    booking_widget_heading: str = "Pick a time"
    # Server rendered so every surface shows the same snippet and the host is
    # never guessed wrong by the frontend.
    chat_snippet: str
    lead_snippet: str
    booking_snippet: str
    booking_page_url: str


class WidgetSettingsUpdate(BaseModel):
    accent_color: Optional[str] = Field(default=None, max_length=20)
    lead_widget_enabled: Optional[bool] = None
    lead_widget_button_text: Optional[str] = Field(default=None, max_length=60)
    lead_widget_heading: Optional[str] = Field(default=None, max_length=80)
    booking_widget_enabled: Optional[bool] = None
    booking_widget_button_text: Optional[str] = Field(default=None, max_length=60)
    booking_widget_heading: Optional[str] = Field(default=None, max_length=80)


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
