from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


class WeeklySlotEntry(BaseModel):
    time: str  # HH:MM start
    end_time: Optional[str] = None  # HH:MM end; if omitted, defaults to 30 min after start
    capacity: int = Field(ge=1)


class CalendarSettingsOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    work_start_hour: int
    work_end_hour: int
    slot_minutes: int
    booking_expiry_days: int
    booking_window_days: int = 60
    weekly_slots: Optional[list] = None
    use_weekly_slots: bool = False
    cancel_edit_hours_before: int = 24
    min_notice_days: int = 0
    timezone: str = "Europe/Amsterdam"
    assignment_mode: Literal["pooled", "auto_assign"] = "pooled"
    booking_direction: Literal["availability", "requests"] = "availability"
    request_fulfillment: Literal["dispatcher", "self_claim"] = "dispatcher"

    model_config = {"from_attributes": True}


class CalendarSettingsUpdate(BaseModel):
    work_start_hour: Optional[int] = Field(default=None, ge=0, le=23)
    work_end_hour: Optional[int] = Field(default=None, ge=1, le=24)
    slot_minutes: Optional[int] = Field(default=None, ge=5, le=240)
    booking_expiry_days: Optional[int] = Field(default=None, ge=1, le=60)
    booking_window_days: Optional[int] = Field(default=None, ge=7, le=365)
    weekly_slots: Optional[list] = None
    use_weekly_slots: Optional[bool] = None
    cancel_edit_hours_before: Optional[int] = Field(default=None, ge=1, le=720)
    min_notice_days: Optional[int] = Field(default=None, ge=0, le=30)
    timezone: Optional[str] = None
    assignment_mode: Optional[Literal["pooled", "auto_assign"]] = None
    booking_direction: Optional[Literal["availability", "requests"]] = None
    request_fulfillment: Optional[Literal["dispatcher", "self_claim"]] = None


class SlotProposal(BaseModel):
    start: datetime
    end: datetime


class AvailableSlot(BaseModel):
    start: datetime
    end: datetime
    available: bool


class BookingTokenCreate(BaseModel):
    contact_id: uuid.UUID
    mode: Literal["open", "propose"]
    proposed_slots: Optional[list[SlotProposal]] = None
    message: Optional[str] = None
    stage_id_override: Optional[uuid.UUID] = None
    from_email: Optional[str] = None

    @model_validator(mode="after")
    def _propose_requires_slots(self) -> "BookingTokenCreate":
        if self.mode == "propose" and not self.proposed_slots:
            raise ValueError("propose mode requires at least one proposed slot")
        return self


class BookingTokenOut(BaseModel):
    id: uuid.UUID
    contact_id: uuid.UUID
    contact_name: Optional[str] = None
    created_by: uuid.UUID
    created_by_name: Optional[str] = None
    mode: str
    proposed_slots: Optional[list[SlotProposal]] = None
    message: Optional[str] = None
    expires_at: datetime
    booked_at: Optional[datetime] = None
    event_id: Optional[uuid.UUID] = None
    customer_proposed_slots: Optional[list] = None
    stage_id_override: Optional[uuid.UUID] = None
    created_at: datetime
    status: Literal["pending", "booked", "expired", "counter_proposed"]

    model_config = {"from_attributes": True}


class CounterProposeRequest(BaseModel):
    slots: list[SlotProposal] = Field(min_length=1, max_length=3)


class PublicBookingOut(BaseModel):
    tenant_name: str
    contact_first_name: str
    mode: str
    proposed_slots: Optional[list[SlotProposal]] = None
    message: Optional[str] = None
    expires_at: datetime
    available_slots: list[AvailableSlot]


class ManageBookingOut(BaseModel):
    tenant_name: str
    contact_first_name: str
    start_at: datetime
    end_at: datetime
    locked: bool
    available_slots: list[AvailableSlot]
    cancel_edit_hours_before: int


class RescheduleRequest(BaseModel):
    slot_start: datetime
    slot_end: datetime


class BookingConfirm(BaseModel):
    slot_start: datetime
    slot_end: datetime


# --------------------------------------------------------------------------- #
# Worker availability
# --------------------------------------------------------------------------- #
class WorkerAvailabilityOut(BaseModel):
    # weekly_slots is keyed "0"–"6" (Mon–Sun), each value a list of WeeklySlotEntry.
    weekly_slots: Optional[dict[str, list[WeeklySlotEntry]]] = None
    timezone: Optional[str] = None
    is_active: bool = True

    model_config = {"from_attributes": True}


class WorkerAvailabilityUpdate(BaseModel):
    weekly_slots: Optional[dict[str, list[WeeklySlotEntry]]] = None
    timezone: Optional[str] = None
    is_active: Optional[bool] = None


class WorkerSummary(BaseModel):
    """Admin-facing overview row for one worker on the Teams page."""
    user_id: uuid.UUID
    full_name: Optional[str] = None
    email: Optional[str] = None
    is_active_user: bool = True
    availability_active: bool = False
    slot_count: int = 0
    timezone: Optional[str] = None


# --------------------------------------------------------------------------- #
# Customer requested bookings (reverse direction)
# --------------------------------------------------------------------------- #
class PublicRequestCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: str = Field(min_length=3, max_length=255)
    message: Optional[str] = Field(default=None, max_length=2000)
    requested_slots: list[SlotProposal] = Field(min_length=1, max_length=5)


class PublicRequestOut(BaseModel):
    """What the public /request/{slug} page needs to render its form."""
    tenant_name: str
    min_notice_days: int = 0
    booking_window_days: int = 60


class BookingRequestOut(BaseModel):
    id: uuid.UUID
    contact_id: uuid.UUID
    contact_name: Optional[str] = None
    requested_slots: Optional[list[SlotProposal]] = None
    message: Optional[str] = None
    status: str
    assigned_worker_id: Optional[uuid.UUID] = None
    assigned_worker_name: Optional[str] = None
    event_id: Optional[uuid.UUID] = None
    chosen_slot_start: Optional[datetime] = None
    chosen_slot_end: Optional[datetime] = None
    created_at: datetime


class WorkerRequestOut(BaseModel):
    """Open request as shown to a worker for self-claim (minimal customer detail)."""
    id: uuid.UUID
    contact_first_name: Optional[str] = None
    requested_slots: list[SlotProposal] = []
    message: Optional[str] = None
    created_at: datetime


class ClaimRequest(BaseModel):
    slot_start: datetime
    slot_end: datetime


class AssignRequest(BaseModel):
    worker_user_id: uuid.UUID
    slot_start: datetime
    slot_end: datetime


class WorkerContextOut(BaseModel):
    booking_direction: str
    request_fulfillment: str
