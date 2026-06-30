from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel

ContextType = Literal["contact", "ticket", "none"]


class CaptureRequest(BaseModel):
    body: str
    context_type: ContextType = "none"
    context_id: Optional[str] = None


class CaptureResponse(BaseModel):
    action_taken: str
    summary: str
    navigate_to: Optional[str] = None
    inline_data: Optional[dict] = None


class ReminderOut(BaseModel):
    id: uuid.UUID
    body: str
    remind_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}
