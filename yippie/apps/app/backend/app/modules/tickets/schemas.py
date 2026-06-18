from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.modules.tickets.models import MessageSource, TicketPriority, TicketStatus


class BulkDeleteTicketsRequest(BaseModel):
    ids: list[uuid.UUID]


class TicketCreate(BaseModel):
    subject: str
    description: Optional[str] = None
    contact_id: Optional[uuid.UUID] = None
    priority: TicketPriority = TicketPriority.medium
    assigned_to: Optional[uuid.UUID] = None
    source: MessageSource = MessageSource.manual
    department_id: Optional[uuid.UUID] = None


class TicketStatusUpdate(BaseModel):
    status: TicketStatus


class TicketMergeRequest(BaseModel):
    # The secondary ticket that will be merged INTO the primary (path) ticket.
    secondary_ticket_id: uuid.UUID


class TicketUpdate(BaseModel):
    subject: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[TicketPriority] = None
    assigned_to: Optional[uuid.UUID] = None
    contact_id: Optional[uuid.UUID] = None
    department_id: Optional[uuid.UUID] = None


class TicketOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    contact_id: Optional[uuid.UUID]
    subject: str
    description: Optional[str]
    status: TicketStatus
    priority: TicketPriority
    source: MessageSource
    assigned_to: Optional[uuid.UUID]
    department_id: Optional[uuid.UUID] = None
    department_name: Optional[str] = None
    last_comment: Optional[str] = None
    last_comment_at: Optional[datetime] = None
    sla_due_at: Optional[datetime]
    resolved_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TicketList(BaseModel):
    items: list[TicketOut]
    total: int


class CommentCreate(BaseModel):
    body: str
    is_internal: bool = False


class CommentOut(BaseModel):
    id: uuid.UUID
    ticket_id: uuid.UUID
    author_id: Optional[uuid.UUID]
    body: str
    is_internal: bool
    source: MessageSource
    created_at: datetime

    model_config = {"from_attributes": True}


class CampaignButton(BaseModel):
    id: str  # client-generated UUID string
    text: str  # display label on the button
    # Tracked actions ('label', 'pipeline_stage') mint a LabelClickToken at send
    # time; direct-link actions ('open_website', 'send_mail', 'call_phone') render
    # as plain <a> links built from action_value (URL / email / phone).
    action_type: str = "label"
    label_id: str | None = None
    stage_id: str | None = None
    action_value: str | None = None  # URL / email / phone for direct-link actions
    multiple_allowed: bool = False  # can a contact click multiple buttons?
    bg_color: str = "#5BA4F5"
    text_color: str = "#ffffff"
    border_radius: int = 6  # px
    font_size: int = 14  # px
    font_weight: str = "600"
    border_color: str | None = None  # outline color, None = no border
    border_width: int = 0  # px


class TemplateCreate(BaseModel):
    name: str
    body: str = ""  # plain text fallback, keep for compat
    design_json: str | None = None
    html_body: str | None = None
    campaign_buttons: list[CampaignButton] = []


class TemplateUpdate(BaseModel):
    name: str | None = None
    body: str | None = None
    design_json: str | None = None
    html_body: str | None = None
    campaign_buttons: list[CampaignButton] | None = None


class TemplateOut(BaseModel):
    id: uuid.UUID
    name: str
    body: str
    design_json: str | None = None
    html_body: str | None = None
    campaign_buttons: str | None = None  # raw JSON string
    created_at: datetime

    model_config = {"from_attributes": True}


class TemplateSuggestRequest(BaseModel):
    context: str
