from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class MessageSource(str, enum.Enum):
    email = "email"
    whatsapp = "whatsapp"


class DraftStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    forwarded = "forwarded"
    bin = "bin"
    spam = "spam"


class InboundMessage(Base):
    __tablename__ = "inbound_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    source: Mapped[MessageSource] = mapped_column(Enum(MessageSource), nullable=False)
    sender: Mapped[str] = mapped_column(String(255), nullable=False)
    sender_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    subject: Mapped[str | None] = mapped_column(String(500), nullable=True)
    raw_body: Mapped[str] = mapped_column(Text, nullable=False)
    raw_headers: Mapped[str | None] = mapped_column(Text, nullable=True)
    resend_email_id: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True, index=True)
    inbound_to: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    attachments_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DraftTicket(Base):
    __tablename__ = "draft_tickets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    inbound_message_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inbound_messages.id"), nullable=False)
    status: Mapped[DraftStatus] = mapped_column(Enum(DraftStatus), nullable=False, default=DraftStatus.pending)

    # Auto-matched contact (from sender email lookup)
    matched_contact_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("contacts.id"), nullable=True)

    # AI-generated customer briefing shown in the context window
    context_summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    # AI-suggested ticket fields (editable before approval)
    ai_suggested_subject: Mapped[str] = mapped_column(String(500), nullable=False)
    ai_suggested_description: Mapped[str] = mapped_column(Text, nullable=False)
    ai_suggested_priority: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
    ai_suggested_category: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Agent edits (override AI suggestions before approval)
    final_subject: Mapped[str | None] = mapped_column(String(500), nullable=True)
    final_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    final_priority: Mapped[str | None] = mapped_column(String(20), nullable=True)
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    contact_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("contacts.id"), nullable=True)

    approved_ticket_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    forwarded_to_department_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    detected_language: Mapped[str | None] = mapped_column(String(10), nullable=True, default="en")
    follow_up_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PendingSend(Base):
    __tablename__ = "pending_sends"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    draft_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    to_email: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    reply_text: Mapped[str] = mapped_column(Text, nullable=False)
    send_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    contact_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    attachments_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
