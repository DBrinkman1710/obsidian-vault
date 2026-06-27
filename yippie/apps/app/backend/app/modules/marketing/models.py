"""MKTG1 — Marketing module ORM models.

Five tenant-scoped tables driving the campaign lifecycle:
campaigns, campaign_templates, campaign_analytics, campaign_sequences,
contact_unsubscribes. All carry tenant_id and are protected by an RLS
tenant_isolation policy (see migration mktg1_marketing_module).
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    subject: Mapped[str] = mapped_column(Text, nullable=False)
    # 'draft' | 'scheduled' | 'sending' | 'completed'
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # 'email' | 'whatsapp'
    dispatch_channel: Mapped[str] = mapped_column(String(20), nullable=False, default="email")
    # 'a' | 'b' | None
    ab_winner: Mapped[str | None] = mapped_column(String(1), nullable=True)
    # Saved audience filter (SegmentFilter) — {"filter_by": ..., "filter_id": ...}
    segment_filter: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # Move every dispatched contact to this stage at send time.
    post_send_stage_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pipeline_stages.id", ondelete="SET NULL"), nullable=True
    )
    # Move replying contacts to this stage (set in Actions tab).
    reply_received_stage_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pipeline_stages.id", ondelete="SET NULL"), nullable=True
    )
    # Maps {button_id: stage_id} — authoritative source for button→stage assignments.
    button_stage_config: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # Which Kanban stage "owns" this campaign (for right-click Send campaign).
    linked_stage_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pipeline_stages.id", ondelete="SET NULL"), nullable=True
    )
    # When the campaign actually started dispatching — anchors drip-step timing.
    dispatched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class CampaignTemplate(Base):
    __tablename__ = "campaign_templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True
    )
    raw_html: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_css: Mapped[str | None] = mapped_column(Text, nullable=True)
    # GrapesJS project JSON — powers the visual editor in the marketing UI
    design_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Serialised CampaignButton[] extracted from the GrapesJS design
    campaign_buttons: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 'a' | 'b' | None — two template variants per campaign for A/B testing.
    variant: Mapped[str | None] = mapped_column(String(1), nullable=True)


class CampaignAnalytics(Base):
    __tablename__ = "campaign_analytics"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True
    )
    recipient_email: Mapped[str] = mapped_column(Text, nullable=False)
    # 'sent' | 'opened' | 'clicked' | 'replied'
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="sent")
    tracking_token: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), unique=True, nullable=False, default=uuid.uuid4
    )
    # Which template variant this recipient received ('a' | 'b' | None).
    variant: Mapped[str | None] = mapped_column(String(1), nullable=True)
    reply_classification: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class CampaignSequence(Base):
    __tablename__ = "campaign_sequences"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True
    )
    delay_days: Mapped[int] = mapped_column(Integer, nullable=False)
    subject: Mapped[str] = mapped_column(Text, nullable=False)
    html_body: Mapped[str] = mapped_column(Text, nullable=False)
    # Set once the step has been dispatched, so the drip job doesn't re-send it.
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ContactUnsubscribe(Base):
    __tablename__ = "contact_unsubscribes"

    contact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="CASCADE"), primary_key=True
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    unsubscribed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ContactBounce(Base):
    __tablename__ = "contact_bounces"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="CASCADE"), nullable=True, index=True
    )
    campaign_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="SET NULL"), nullable=True
    )
    bounce_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    bounced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
