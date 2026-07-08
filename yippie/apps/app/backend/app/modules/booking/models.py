from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
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
    min_notice_days: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    timezone: Mapped[str] = mapped_column(
        String(64), nullable=False, default="Europe/Amsterdam", server_default="Europe/Amsterdam"
    )
    # How a worker is attached when a customer books a slot.
    #   'pooled'      — slot is bookable if any worker is free; who goes is decided later.
    #   'auto_assign' — booking locks one available worker and consumes their availability.
    # Plain VARCHAR (validated at the app layer) so new modes never need ALTER TYPE.
    assignment_mode: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pooled", server_default="pooled"
    )
    # Which direction the booking flow runs (mutually exclusive for now):
    #   'availability' — workers post hours, customers book into them (default).
    #   'requests'     — customers request a time, a worker/dispatcher fulfils it.
    booking_direction: Mapped[str] = mapped_column(
        String(20), nullable=False, default="availability", server_default="availability"
    )
    # In 'requests' mode, who turns an open request into an appointment:
    #   'dispatcher' — an admin assigns each request to a worker (default).
    #   'self_claim' — workers claim open requests themselves (first wins).
    request_fulfillment: Mapped[str] = mapped_column(
        String(20), nullable=False, default="dispatcher", server_default="dispatcher"
    )


class BookingRequest(Base):
    """A customer-initiated appointment request (reverse of availability booking).

    The customer proposes one or more times; a worker (self_claim) or an admin
    (dispatcher) turns it into a confirmed CalendarEvent. Kept separate from
    BookingToken, which is agent-first and single-use.
    """

    __tablename__ = "booking_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True
    )
    contact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # List of {start, end} ISO strings the customer proposed.
    requested_slots: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 'open' | 'fulfilled' | 'cancelled'
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open", server_default="open")
    assigned_worker_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    fulfilled_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    event_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("calendar_events.id", ondelete="SET NULL"), nullable=True
    )
    chosen_slot_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    chosen_slot_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class WorkerAvailability(Base):
    """Per worker recurring availability. The union of all active workers'
    weekly_slots drives the bookable slots customers see. Kept separate from
    CalendarEvent (which get_available_slots treats as *busy* time) so declaring
    availability never collides with the busy-time overlap checks.

    Future skill matching hangs off user_id: a worker_service_types(worker_user_id,
    service_type_id) join would let get_available_slots filter workers by the
    service a customer requests. Not built yet — the user_id key makes it additive.
    """

    __tablename__ = "worker_availability"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Same shape as CalendarSettings.weekly_slots: keyed "0"–"6" (Mon–Sun), each
    # value a list of {time, end_time, capacity} dicts. capacity is normally 1 per
    # worker but kept so a worker can self-declare higher capacity.
    weekly_slots: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # Falls back to the tenant CalendarSettings.timezone when null.
    timezone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (UniqueConstraint("tenant_id", "user_id"),)


class WorkerAvailabilityException(Base):
    """One off date overrides for a worker. An empty `slots` list means the
    worker is off that whole day; a populated list replaces that weekday's
    recurring entries for that date.
    """

    __tablename__ = "worker_availability_exceptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    date: Mapped[datetime] = mapped_column(Date, nullable=False)
    slots: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint("tenant_id", "user_id", "date"),)


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
    stage_id_override: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("pipeline_stages.id", ondelete="SET NULL"),
        nullable=True,
    )
    from_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
