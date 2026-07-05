from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict


class ProvidersOut(BaseModel):
    gmail: bool
    outlook: bool


class ConnectRequest(BaseModel):
    provider: Literal["gmail", "outlook"]
    level: Literal["tenant", "user"]


class ConnectOut(BaseModel):
    authorize_url: str


class EmailAccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    provider: str
    email_address: str
    display_name: Optional[str] = None
    user_id: Optional[uuid.UUID] = None
    status: str
    last_error: Optional[str] = None
    last_synced_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
