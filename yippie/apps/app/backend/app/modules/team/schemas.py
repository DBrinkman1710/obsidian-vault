from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class TeamUserOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    last_login_at: Optional[datetime]

    model_config = {"from_attributes": True}


class TeamInviteRequest(BaseModel):
    email: EmailStr
    full_name: str
    role: str = "agent"  # agent | admin | viewer


class TeamUserUpdate(BaseModel):
    is_active: Optional[bool] = None
    role: Optional[str] = None  # agent | admin | viewer
