from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ExternalCalendarFeedCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    ical_url: str = Field(min_length=10, max_length=2000)


class ExternalCalendarFeedUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    ical_url: Optional[str] = Field(default=None, min_length=10, max_length=2000)
    is_active: Optional[bool] = None


class ExternalCalendarFeedOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    ical_url: str
    last_synced_at: Optional[datetime]
    last_sync_error: Optional[str]
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
