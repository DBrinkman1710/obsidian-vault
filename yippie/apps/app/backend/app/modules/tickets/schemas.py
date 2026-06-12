from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.modules.tickets.models import MessageSource, TicketPriority, TicketStatus


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


class TemplateCreate(BaseModel):
    name: str
    body: str


class TemplateUpdate(BaseModel):
    name: str | None = None
    body: str | None = None


class TemplateOut(BaseModel):
    id: uuid.UUID
    name: str
    body: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TemplateSuggestRequest(BaseModel):
    context: str
