from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class PipelineStageCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    color: str = Field(default="#64748b", pattern=r"^#[0-9a-fA-F]{6}$")


class PipelineStageUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    color: Optional[str] = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")


class PipelineStageOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    color: str
    display_order: int
    created_at: datetime
    contact_count: int = 0

    model_config = {"from_attributes": True}


class PipelineReorder(BaseModel):
    ids: list[uuid.UUID]


class PipelineBoardContact(BaseModel):
    contact_id: uuid.UUID
    full_name: str
    email: Optional[str]
    company_name: Optional[str]
    entered_at: datetime


class PipelineBoardColumn(BaseModel):
    stage: PipelineStageOut
    contacts: list[PipelineBoardContact]


class MoveToStage(BaseModel):
    stage_id: uuid.UUID
