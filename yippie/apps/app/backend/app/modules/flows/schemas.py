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


MAX_GROUPS = 5
MAX_CONDITIONS_PER_GROUP = 10


def _normalize_condition_groups(raw: Any) -> list:
    """Coerce incoming conditions — a flat list [A, B] or a list of OR groups
    [[A, B], [C]] — into the grouped form, enforcing structure: at most 5 groups,
    1–10 conditions per group, nesting depth exactly 2, no empty groups. Returns
    the grouped list for per-condition ConditionSpec validation."""
    if not raw:
        return []
    if not isinstance(raw, list):
        raise ValueError("conditions must be a list")
    grouped = isinstance(raw[0], list)
    groups = raw if grouped else [raw]
    if len(groups) > MAX_GROUPS:
        raise ValueError(f"A flow may have at most {MAX_GROUPS} OR groups")
    for group in groups:
        if not isinstance(group, list):
            raise ValueError("Mixed flat and grouped conditions are not allowed")
        if not group:
            raise ValueError("Condition groups can't be empty")
        if len(group) > MAX_CONDITIONS_PER_GROUP:
            raise ValueError(
                f"A condition group may have at most {MAX_CONDITIONS_PER_GROUP} conditions"
            )
        for condition in group:
            if isinstance(condition, list):
                raise ValueError("Conditions may only be nested two levels deep")
    return groups


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
    # Accepts a flat list or grouped OR-of-AND; always stored grouped.
    conditions: list[list[ConditionSpec]] = Field(default_factory=list)
    actions: list[ActionSpec] = Field(default_factory=list, max_length=10)
    enabled: bool = True
    trigger_config: dict = Field(default_factory=dict)

    @field_validator("trigger_type")
    @classmethod
    def _known_trigger(cls, v: str) -> str:
        assert v in TRIGGER_META
        return v

    @field_validator("conditions", mode="before")
    @classmethod
    def _group_conditions(cls, v: Any) -> list:
        return _normalize_condition_groups(v)


class FlowUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    trigger_type: Optional[TriggerType] = None
    conditions: Optional[list[list[ConditionSpec]]] = None
    actions: Optional[list[ActionSpec]] = Field(default=None, max_length=10)
    enabled: Optional[bool] = None
    trigger_config: Optional[dict] = None

    @field_validator("conditions", mode="before")
    @classmethod
    def _group_conditions(cls, v: Any) -> Optional[list]:
        if v is None:
            return None
        return _normalize_condition_groups(v)


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
