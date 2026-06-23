"""Shared ORM models for [SALES-MOD1] and [SAAS-MOD1].

SaasEvent and SaasIdentity are shared between both modules — differentiated
by event_domain ('saas' | 'commerce'). SaasHealth is SAAS-MOD1-specific.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class SaasEvent(Base):
    __tablename__ = "saas_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True
    )
    anonymous_id: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # 'saas' | 'commerce'
    event_domain: Mapped[str] = mapped_column(String(20), nullable=False, default="saas")
    event_type: Mapped[str] = mapped_column(Text, nullable=False)
    properties: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    session_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    sdk_version: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SaasIdentity(Base):
    __tablename__ = "saas_identity"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    anonymous_id: Mapped[str] = mapped_column(Text, primary_key=True)
    contact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False
    )
    identified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SaasHealth(Base):
    __tablename__ = "saas_health"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    contact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="CASCADE"), primary_key=True
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    recency_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    breadth_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    error_penalty: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    last_computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
