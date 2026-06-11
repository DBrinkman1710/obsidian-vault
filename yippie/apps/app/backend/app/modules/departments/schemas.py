from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class DepartmentCreate(BaseModel):
    name: str
    email: str
    reply_template: Optional[str] = None
    sla_working_days: int = 3


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    reply_template: Optional[str] = None
    sla_working_days: Optional[int] = None


class DeadlineSettings(BaseModel):
    """Per-tenant thresholds for the Tickets-nav deadline indicator."""
    deadline_red_days: int
    deadline_orange_days: int


class DeadlineSettingsUpdate(BaseModel):
    deadline_red_days: Optional[int] = None
    deadline_orange_days: Optional[int] = None


class DepartmentOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    email: str
    reply_template: Optional[str]
    sla_working_days: int
    created_at: datetime

    model_config = {"from_attributes": True}
