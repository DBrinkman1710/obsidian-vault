from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class CommerceEventOut(BaseModel):
    id: uuid.UUID
    contact_id: Optional[uuid.UUID]
    anonymous_id: str
    event_type: str
    properties: dict
    session_id: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class SalesStatsOut(BaseModel):
    total_events: int
    pageviews: int
    purchases: int
    last_event_at: Optional[datetime]
    top_pages: list[dict]  # [{"url": str, "count": int}]
