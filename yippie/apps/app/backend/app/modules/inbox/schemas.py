from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.modules.inbox.models import DraftStatus, MessageSource


class InboundMessageOut(BaseModel):
    id: uuid.UUID
    source: MessageSource
    sender: str
    sender_name: Optional[str]
    subject: Optional[str]
    raw_body: str
    received_at: datetime

    model_config = {"from_attributes": True}


class DraftTicketOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    inbound_message_id: uuid.UUID
    status: DraftStatus
    matched_contact_id: Optional[uuid.UUID]
    context_summary: Optional[str]
    ai_suggested_subject: str
    ai_suggested_description: str
    ai_suggested_priority: str
    ai_suggested_category: Optional[str]
    final_subject: Optional[str]
    final_description: Optional[str]
    final_priority: Optional[str]
    assigned_to: Optional[uuid.UUID]
    contact_id: Optional[uuid.UUID]
    approved_ticket_id: Optional[uuid.UUID]
    reviewed_at: Optional[datetime]
    follow_up_at: Optional[datetime]
    forwarded_to_department_id: Optional[uuid.UUID]
    detected_language: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ContactBrief(BaseModel):
    id: uuid.UUID
    full_name: str
    email: Optional[str]
    phone: Optional[str]
    company: Optional[str]
    tags: Optional[list[str]]

    model_config = {"from_attributes": True}


class TicketBrief(BaseModel):
    id: uuid.UUID
    subject: str
    status: str
    priority: str
    created_at: datetime

    model_config = {"from_attributes": True}


class SubscriptionBrief(BaseModel):
    plan_name: str
    status: str
    billing_cycle: str
    amount_cents: int
    currency: str

    model_config = {"from_attributes": True}


class DraftWithContextOut(BaseModel):
    draft: DraftTicketOut
    inbound_message: InboundMessageOut
    attachments: list[dict] = []
    contact: Optional[ContactBrief]
    recent_tickets: list[TicketBrief]
    billing: Optional[SubscriptionBrief]


class LinkContactRequest(BaseModel):
    contact_id: uuid.UUID


class SuggestReplyResponse(BaseModel):
    suggestion: str


class ImproveReplyRequest(BaseModel):
    current_text: str


class ImproveSuggestion(BaseModel):
    label: str
    revised_text: str


class ImproveReplyResponse(BaseModel):
    suggestions: list[ImproveSuggestion]


class DraftReview(BaseModel):
    """Agent submits this to approve or reject a draft."""
    action: str  # "approve" or "reject"
    subject: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[uuid.UUID] = None
    contact_id: Optional[uuid.UUID] = None
    follow_up_days: Optional[int] = None


class EmailWebhookPayload(BaseModel):
    """Mailgun inbound email webhook."""
    sender: str
    recipient: str
    subject: Optional[str] = None
    body_plain: Optional[str] = None
    body_html: Optional[str] = None
    message_headers: Optional[str] = None


class WhatsAppWebhookPayload(BaseModel):
    """Twilio WhatsApp inbound webhook."""
    From: str
    Body: str
    ProfileName: Optional[str] = None
