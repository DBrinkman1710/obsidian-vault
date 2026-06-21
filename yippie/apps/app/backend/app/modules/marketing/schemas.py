"""MKTG1 — Marketing module Pydantic schemas."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

Status = Literal["draft", "scheduled", "sending", "completed"]
Channel = Literal["email", "whatsapp"]
Variant = Literal["a", "b"]
AnalyticsStatus = Literal["sent", "opened", "clicked", "replied"]
FilterBy = Literal["label", "company", "pipeline_stage", "all"]


# --- Campaigns -------------------------------------------------------------- #

class SegmentFilter(BaseModel):
    filter_by: FilterBy = "all"
    filter_id: Optional[uuid.UUID] = None


class CampaignCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    subject: str = Field(min_length=1, max_length=500)
    dispatch_channel: Channel = "email"


class CampaignUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    subject: Optional[str] = Field(default=None, min_length=1, max_length=500)
    scheduled_at: Optional[datetime] = None
    dispatch_channel: Optional[Channel] = None
    segment_filter: Optional[SegmentFilter] = None


class CampaignOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    subject: str
    status: Status
    scheduled_at: Optional[datetime] = None
    dispatch_channel: Channel
    ab_winner: Optional[Variant] = None
    segment_filter: Optional[SegmentFilter] = None
    dispatched_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


# --- Templates -------------------------------------------------------------- #

class CampaignTemplateVariant(BaseModel):
    variant: Optional[Variant] = None
    raw_html: Optional[str] = None
    raw_css: Optional[str] = None


class CampaignTemplateCreate(BaseModel):
    """Upsert one or both A/B template variants for a campaign."""
    templates: list[CampaignTemplateVariant] = Field(default_factory=list)


class CampaignTemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    campaign_id: uuid.UUID
    raw_html: Optional[str] = None
    raw_css: Optional[str] = None
    variant: Optional[Variant] = None


# --- Analytics -------------------------------------------------------------- #

class CampaignAnalyticsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    recipient_email: str
    status: AnalyticsStatus
    variant: Optional[Variant] = None
    reply_classification: Optional[str] = None
    updated_at: datetime


class VariantStats(BaseModel):
    variant: Variant
    sent: int = 0
    opened: int = 0
    clicked: int = 0
    replied: int = 0


class CampaignAnalyticsSummary(BaseModel):
    sent: int = 0
    opened: int = 0
    clicked: int = 0
    replied: int = 0
    unsubscribed: int = 0
    open_rate: float = 0.0
    click_rate: float = 0.0
    reply_rate: float = 0.0
    ab_winner: Optional[Variant] = None
    variants: list[VariantStats] = Field(default_factory=list)
    recipients: list[CampaignAnalyticsOut] = Field(default_factory=list)


# --- Sequences (drip) ------------------------------------------------------- #

class CampaignSequenceCreate(BaseModel):
    delay_days: int = Field(ge=0, le=365)
    subject: str = Field(min_length=1, max_length=500)
    html_body: str = Field(min_length=1)


class CampaignSequenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    campaign_id: uuid.UUID
    delay_days: int
    subject: str
    html_body: str
    sent_at: Optional[datetime] = None
    created_at: datetime


# --- Unsubscribes ----------------------------------------------------------- #

class ContactUnsubscribeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    contact_id: uuid.UUID
    unsubscribed_at: datetime
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None


# --- Launch / segments ------------------------------------------------------ #

class CampaignLaunchRequest(BaseModel):
    """Optional overrides at launch time. When omitted, the saved
    segment_filter and an A/B split (if two variants exist) are used."""
    segment_filter: Optional[SegmentFilter] = None
    enable_ab: bool = True


class SegmentPreviewOut(BaseModel):
    count: int
    names: list[str] = Field(default_factory=list)


class LaunchResultOut(BaseModel):
    campaign_id: uuid.UUID
    status: Status
    recipients: int
    skipped_unsubscribed: int = 0
