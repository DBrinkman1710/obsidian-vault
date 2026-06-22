from __future__ import annotations

import uuid
from typing import Optional

from pydantic import BaseModel


class CreateSessionBody(BaseModel):
    phone: str
    contact_id: Optional[uuid.UUID] = None


class ReplyBody(BaseModel):
    body: str


class PatchSessionBody(BaseModel):
    ticket_id: Optional[uuid.UUID] = None
    contact_id: Optional[uuid.UUID] = None


class AssignBody(BaseModel):
    assigned_to: Optional[uuid.UUID] = None


class StatusBody(BaseModel):
    status: str


class BulkSessionBody(BaseModel):
    action: str  # "close" | "reopen" | "delete"
    session_ids: list[uuid.UUID]


class ChatSettingsBody(BaseModel):
    hide_solved_chats_hours: int


class NoteBody(BaseModel):
    body: str


class BroadcastBody(BaseModel):
    contact_ids: list[uuid.UUID]
    message: str
    append_booking_link: bool = False
