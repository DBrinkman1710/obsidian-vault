from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


class WeeklySlotEntry(BaseModel):
    time: str  # HH:MM
    capacity: int = Field(ge=1)


class CalendarSettingsOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    work_start_hour: int
    work_end_hour: int
    slot_minutes: int
    booking_expiry_days: int
    booking_window_days: int = 60
    post_booking_stage_id: Optional[uuid.UUID] = None
    weekly_slots: Optional[list] = None
    use_weekly_slots: bool = False
    cancel_edit_hours_before: int = 24

    model_config = {"from_attributes": True}


class CalendarSettingsUpdate(BaseModel):
    work_start_hour: Optional[int] = Field(default=None, ge=0, le=23)
    work_end_hour: Optional[int] = Field(default=None, ge=1, le=24)
    slot_minutes: Optional[int] = Field(default=None, ge=5, le=240)
    booking_expiry_days: Optional[int] = Field(default=None, ge=1, le=60)
    booking_window_days: Optional[int] = Field(default=None, ge=7, le=365)
    post_booking_stage_id: Optional[uuid.UUID] = None
    weekly_slots: Optional[list] = None
    use_weekly_slots: Optional[bool] = None
    cancel_edit_hours_before: Optional[int] = Field(default=None, ge=1, le=720)


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
