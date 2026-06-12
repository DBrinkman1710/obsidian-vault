from __future__ import annotations
import uuid
from datetime import datetime
from pydantic import BaseModel

class OutboundEmailOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    resend_email_id: str | None
    to_email: str
    subject: str
    actor_id: uuid.UUID | None
    contact_id: uuid.UUID | None
    draft_id: uuid.UUID | None
    kind: str
    status: str
    delivered_at: datetime | None
    opened_at: datetime | None
    clicked_at: datetime | None
    clicked_count: int
    bounced_at: datetime | None
    bounce_type: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
