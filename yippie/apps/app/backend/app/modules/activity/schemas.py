from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ActivityEventOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    contact_id: Optional[uuid.UUID]
    actor_id: Optional[uuid.UUID]
    actor_name: Optional[str] = None
    module: str
    event_type: str
    entity_type: str
    entity_id: Optional[uuid.UUID]
    payload: Optional[dict]
    created_at: datetime

    model_config = {"from_attributes": True}
