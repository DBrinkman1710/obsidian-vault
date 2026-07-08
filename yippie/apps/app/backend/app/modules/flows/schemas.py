from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.modules.flows import steps
from app.modules.flows.actions import ACTION_META
from app.modules.flows.conditions import CONDITION_OPS, TRIGGER_META

TriggerType = Literal[
    "ticket_created",
    "ticket_status_changed",
    "contact_created",
    "pipeline_stage_changed",
    "draft_approved",
]

ActionType = Literal[
    "create_ticket",
    "update_ticket",
    "move_pipeline_stage",
    "notify_user",
    "send_email",
    "wait",
]

# Keys the API accepts inside an action config — anything else is dropped so a
# hostile payload can't smuggle extra kwargs toward the executors.
_ACTION_CONFIG_KEYS: dict[str, set[str]] = {
    action: {f["key"] for f in meta["config_fields"]}
    for action, meta in ACTION_META.items()
}


class ConditionSpec(BaseModel):
    field: str = Field(min_length=1, max_length=100)
    op: Literal["equals", "not_equals", "contains", "in", "gte", "lte"]
    value: Any = None

    @field_validator("op")
    @classmethod
    def _known_op(cls, v: str) -> str:
        assert v in CONDITION_OPS
        return v


class ActionSpec(BaseModel):
    type: ActionType
    config: dict = Field(default_factory=dict)

    @field_validator("config")
    @classmethod
    def _clean_config(cls, v: dict, info) -> dict:
        action = info.data.get("type")
        allowed = _ACTION_CONFIG_KEYS.get(action, set())
        return {k: val for k, val in v.items() if k in allowed and val not in (None, "")}

    @model_validator(mode="after")
    def _validate_wait(self) -> "ActionSpec":
        # A wait's config must describe exactly one valid, capped duration.
        if self.type == "wait":
            steps.wait_delta(self.config)  # raises ValueError → 422
        return self


class FlowCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    trigger_type: TriggerType
    conditions: list[ConditionSpec] = Field(default_factory=list, max_length=10)
    actions: list[ActionSpec] = Field(default_factory=list, max_length=10)
    enabled: bool = True
    trigger_config: dict = Field(default_factory=dict)

    @field_validator("trigger_type")
    @classmethod
    def _known_trigger(cls, v: str) -> str:
        assert v in TRIGGER_META
        return v


class FlowUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    trigger_type: Optional[TriggerType] = None
    conditions: Optional[list[ConditionSpec]] = Field(default=None, max_length=10)
    actions: Optional[list[ActionSpec]] = Field(default=None, max_length=10)
    enabled: Optional[bool] = None
    trigger_config: Optional[dict] = None


class FlowOut(BaseModel):
    id: uuid.UUID
    name: str
    enabled: bool
    trigger_type: str
    trigger_config: dict
    conditions: list
    actions: list
    run_count: int
    last_run_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class FlowRunOut(BaseModel):
    id: uuid.UUID
    flow_id: uuid.UUID
    event: dict
    status: str
    results: list
    error: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class RecipeOut(BaseModel):
    key: str
    name: str
    description: str
    trigger_type: str
    conditions: list
    actions: list
