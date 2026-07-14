from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, Text
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
    # Set when ingested from a linked Gmail/Outlook mailbox (email_accounts):
    # provider_message_id dedupes per account (unique partial index, see EML1
    # migration); smtp_message_id is the RFC822 Message-ID for reply threading.
    email_account_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    provider_message_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    smtp_message_id: Mapped[str | None] = mapped_column(Text, nullable=True)
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
    matched_contact_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True)

    # AI-generated customer briefing shown in the context window
    context_summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Async AI enrichment: 'queued' (waiting for the background scan),
    # 'done' (enriched, or AI disabled for this tenant), 'failed' (scan errored —
    # raw fallback fields are shown and the agent can retry via /generate)
    ai_status: Mapped[str] = mapped_column(String(20), nullable=False, default="done", server_default="done")

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
    contact_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True)

    approved_ticket_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    forwarded_to_department_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    detected_language: Mapped[str | None] = mapped_column(String(10), nullable=True, default="en")
    follow_up_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # When the draft was last moved to bin/spam — drives the retention jobs (item 42)
    status_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Set on first view in DraftReview — drives "unread" sidebar badge
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # [ACTIVITY2] who first opened this draft — powers avg time to open per user
    opened_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    # [ACTIVITY2] why a draft was rejected: thank_you|spam|duplicate|no_action
    reject_reason: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        # enrich_queued_drafts runs every 10s with FOR UPDATE SKIP LOCKED on ai_status='queued'
        Index("ix_draft_tickets_ai_status_status_created", "ai_status", "status", "created_at"),
    )


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
    from_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Transport snapshot at queue time: when set, dispatch via this linked
    # Gmail/Outlook account instead of Resend (same rationale as from_email).
    email_account_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    # "reply" (draft_id = the draft) or "compose" (draft_id = a batch id shared
    # by all recipients of one compose, so one undo cancels the whole batch)
    kind: Mapped[str] = mapped_column(String(20), nullable=False, default="reply", server_default="reply")
    # Phase 9C: JSON array of campaign buttons (label-mapped) and the template's
    # pre-rendered HTML body, snapshotted at queue time.
    campaign_buttons_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    prerendered_html: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Optional CC/BCC addresses — JSON arrays stored as text e.g. '["a@b.com"]'
    cc_emails: Mapped[str | None] = mapped_column(Text, nullable=True)
    bcc_emails: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Dispatch attempts so far. flush_pending_sends claims a row by bumping this
    # and pushing send_at forward (a lease); rows at the attempt cap are never
    # selected again and remain in the table as a dead-letter record.
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        # flush_pending_sends queries send_at <= now every 5s
        Index("ix_pending_sends_send_at", "send_at"),
    )
