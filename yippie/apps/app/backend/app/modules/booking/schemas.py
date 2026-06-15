from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


class CalendarSettingsOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    work_start_hour: int
    work_end_hour: int
    slot_minutes: int
    booking_expiry_days: int
    post_booking_stage_id: Optional[uuid.UUID] = None

    model_config = {"from_attributes": True}


class CalendarSettingsUpdate(BaseModel):
    work_start_hour: Optional[int] = Field(default=None, ge=0, le=23)
    work_end_hour: Optional[int] = Field(default=None, ge=1, le=24)
    slot_minutes: Optional[int] = Field(default=None, ge=5, le=240)
    booking_expiry_days: Optional[int] = Field(default=None, ge=1, le=60)
    post_booking_stage_id: Optional[uuid.UUID] = None


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
    created_at: datetime
    status: Literal["pending", "booked", "expired"]

    model_config = {"from_attributes": True}


class PublicBookingOut(BaseModel):
    tenant_name: str
    contact_first_name: str
    mode: str
    proposed_slots: Optional[list[SlotProposal]] = None
    message: Optional[str] = None
    expires_at: datetime
    available_slots: list[AvailableSlot]


class BookingConfirm(BaseModel):
    slot_start: datetime
    slot_end: datetime
