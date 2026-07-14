from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="websocket")  # "websocket" | "whatsapp"
    visitor_id: Mapped[str] = mapped_column(String(255), nullable=False)
    visitor_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    visitor_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    whatsapp_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)  # E.164 phone for WhatsApp sessions
    contact_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True)
    ticket_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("tickets.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="open", default="open")  # open | assigned | solved | ticket
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    solved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_open: Mapped[bool] = mapped_column(Boolean, default=True)
    unread_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0", default=0)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("chat_sessions.id"), nullable=False)
    sender_type: Mapped[str] = mapped_column(String(20), nullable=False)  # "visitor" or "agent"
    sender_id: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    msg_status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="sent", default="sent")  # sent | delivered | read
    evolution_msg_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    msg_type: Mapped[str] = mapped_column(String(20), nullable=False, server_default="text", default="text")  # text | media
    media_url: Mapped[str | None] = mapped_column(Text, nullable=True)  # base64 data URI or reference for media messages
    media_filename: Mapped[str | None] = mapped_column(String(500), nullable=True)  # original filename for document messages
    media_mime: Mapped[str | None] = mapped_column(String(100), nullable=True)  # MIME type e.g. image/jpeg, application/pdf
