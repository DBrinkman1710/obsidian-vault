from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class SaasEventOut(BaseModel):
    id: uuid.UUID
    contact_id: Optional[uuid.UUID]
    anonymous_id: str
    event_domain: str
    event_type: str
    properties: dict
    session_id: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class SaasHealthOut(BaseModel):
    contact_id: uuid.UUID
    score: int
    recency_score: Decimal
    breadth_score: Decimal
    error_penalty: Decimal
    last_computed_at: datetime
    # Derived colour band for the frontend badge
    color: str  # 'green' | 'amber' | 'red'

    model_config = {"from_attributes": True}


class HealthSummaryOut(BaseModel):
    total_contacts_tracked: int
    onboarding_completion_pct: float  # % of tracked contacts with any onboarding_step event
    top_features: list[dict]          # [{"feature": str, "count": int}]
    common_errors: list[dict]         # [{"error_code": str, "count": int}]
    at_risk_count: int                # contacts with score < 40
