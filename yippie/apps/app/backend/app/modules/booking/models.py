from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class CalendarSettings(Base):
    __tablename__ = "calendar_settings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, unique=True
    )
    work_start_hour: Mapped[int] = mapped_column(Integer, nullable=False, default=9)
    work_end_hour: Mapped[int] = mapped_column(Integer, nullable=False, default=17)
    slot_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    booking_expiry_days: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    # How many days into the future public booking pages offer slots. Distinct
    # from booking_expiry_days (which governs how long an invite link is valid).
    booking_window_days: Mapped[int] = mapped_column(
        Integer, nullable=False, default=60, server_default="60"
    )
    post_booking_stage_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("pipeline_stages.id", ondelete="SET NULL"),
        nullable=True,
    )
    weekly_slots: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    use_weekly_slots: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    cancel_edit_hours_before: Mapped[int] = mapped_column(
        Integer, nullable=False, default=24, server_default="24"
    )
    timezone: Mapped[str] = mapped_column(
        String(64), nullable=False, default="Europe/Amsterdam", server_default="Europe/Amsterdam"
    )


class BookingToken(Base):
    __tablename__ = "booking_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True
    )
    contact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    mode: Mapped[str] = mapped_column(String(10), nullable=False)  # 'open' | 'propose'
    proposed_slots: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    booked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    event_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("calendar_events.id", ondelete="SET NULL"), nullable=True
    )
    customer_proposed_slots: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    status_override: Mapped[str | None] = mapped_column(String(20), nullable=True)
    manage_token: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, unique=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
