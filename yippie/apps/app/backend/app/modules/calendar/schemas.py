from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, model_validator


class CalendarEventCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    start_at: datetime
    end_at: Optional[datetime] = None
    all_day: bool = False
    contact_id: Optional[uuid.UUID] = None
    ticket_id: Optional[uuid.UUID] = None
    calendar_type: str = "shared"
    # Request-only: when True (default) and a contact is linked, the contact is
    # emailed an invitation/notification. Not persisted to the DB.
    notify_contact: bool = True

    @model_validator(mode="after")
    def _end_after_start(self) -> "CalendarEventCreate":
        if self.end_at is not None and self.end_at < self.start_at:
            raise ValueError("end_at must be after start_at")
        return self


class CalendarEventUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    all_day: Optional[bool] = None
    contact_id: Optional[uuid.UUID] = None
    ticket_id: Optional[uuid.UUID] = None
    calendar_type: Optional[str] = None
    # Request-only: suppress the contact notification on update. Not persisted.
    notify_contact: bool = True


class InvitationOut(BaseModel):
    id: uuid.UUID
    event_id: uuid.UUID
    invitee_id: uuid.UUID
    invitee_name: str
    invitee_email: str
    status: str
    counter_proposed_slots: Optional[list] = None
    message: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CalendarEventOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    title: str
    description: Optional[str] = None
    start_at: datetime
    end_at: Optional[datetime] = None
    all_day: bool
    contact_id: Optional[uuid.UUID] = None
    contact_name: Optional[str] = None
    ticket_id: Optional[uuid.UUID] = None
    ticket_subject: Optional[str] = None
    created_by: uuid.UUID
    assigned_worker_id: Optional[uuid.UUID] = None
    calendar_type: str = "shared"
    created_at: datetime
    invitations: List[InvitationOut] = []

    model_config = {"from_attributes": True}


class InvitationCreate(BaseModel):
    user_ids: List[uuid.UUID]


class SlotProposal(BaseModel):
    start: datetime
    end: datetime


class InvitationRespond(BaseModel):
    status: Literal["accepted", "declined", "counter_proposed"]
    counter_proposed_slots: Optional[List[SlotProposal]] = None
    message: Optional[str] = None


class PendingInvitationOut(BaseModel):
    id: uuid.UUID
    event_id: uuid.UUID
    event_title: str
    event_start_at: datetime
    event_end_at: Optional[datetime] = None
    event_all_day: bool
    organiser_name: str
    status: str
    counter_proposed_slots: Optional[list] = None
    message: Optional[str] = None
    created_at: datetime


class CalendarItem(BaseModel):
    """One entry in the range query — either a standalone event (full CRUD)
    or a ticket follow-up deadline (read-only, links to the ticket)."""

    kind: Literal["event", "deadline"]
    id: uuid.UUID                       # event id, or ticket id for deadlines
    title: str                          # event title, or ticket subject
    start_at: datetime                  # event start, or the ticket's deadline
    end_at: Optional[datetime] = None
    all_day: bool = False
    description: Optional[str] = None
    contact_id: Optional[uuid.UUID] = None
    contact_name: Optional[str] = None
    ticket_id: Optional[uuid.UUID] = None
    ticket_subject: Optional[str] = None
    calendar_type: Optional[str] = None  # "shared" | "personal" — None for deadline items
    created_by: Optional[uuid.UUID] = None
    # Deadline-only context, used by the UI for urgency colouring
    ticket_status: Optional[str] = None
    ticket_priority: Optional[str] = None
    # Invitation context — set when item comes from an accepted invitation
    invitation_status: Optional[str] = None
    is_invited: bool = False


class CalendarItemList(BaseModel):
    items: list[CalendarItem]
