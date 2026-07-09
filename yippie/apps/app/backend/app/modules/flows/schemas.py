from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated, Any, Literal, Optional, Union

from pydantic import BaseModel, Field, field_validator, model_validator

from app.modules.flows import graph, steps
from app.modules.flows.actions import ACTION_META
from app.modules.flows.conditions import CONDITION_OPS, TRIGGER_META

# [FLOW7] trigger_type is a free str validated against the registry (TRIGGER_META)
# — the fixed Literal is gone so a new module's trigger needs no schema edit.
ActionType = Literal[
    "create_ticket",
    "update_ticket",
    "move_pipeline_stage",
    "notify_user",
    "send_email",
    "send_webhook",
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


class ScheduleConfigSpec(BaseModel):
    """trigger_config for the `schedule` trigger. daily needs only a time;
    weekly also needs a weekday (0=Mon … 6=Sun). Validated on write; the engine's
    schedule tick reads it back through steps.schedule_is_due."""
    frequency: Literal["daily", "weekly"]
    time: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    weekday: Optional[int] = Field(default=None, ge=0, le=6)

    @model_validator(mode="after")
    def _weekly_needs_weekday(self) -> "ScheduleConfigSpec":
        if self.frequency == "weekly" and self.weekday is None:
            raise ValueError("A weekly schedule needs a weekday")
        if self.frequency == "daily":
            self.weekday = None  # a daily schedule ignores any weekday
        return self


class ConditionSpec(BaseModel):
    field: str = Field(min_length=1, max_length=100)
    op: Literal["equals", "not_equals", "contains", "in", "gte", "lte"]
    value: Any = None

    @field_validator("op")
    @classmethod
    def _known_op(cls, v: str) -> str:
        assert v in CONDITION_OPS
        return v


_NODE_ID_PATTERN = r"^[A-Za-z0-9_]{1,36}$"


class ActionSpec(BaseModel):
    # [FLOW3] Stable per-action identity, stamped into flow_runs.results so run
    # replay on the canvas survives reorders (and [FLOW4]'s DAG keeps working
    # against history). Client-generated ids round-trip; missing ids are minted
    # server-side on write. Legacy stored actions without an id stay valid —
    # the engine stamps None and the canvas falls back to list position.
    id: str = Field(
        default_factory=lambda: uuid.uuid4().hex,
        pattern=_NODE_ID_PATTERN,
    )
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


class BranchSpec(BaseModel):
    """[FLOW4] A branch node: OR-of-AND condition groups in config["conditions"]
    (identical shape to flow-level conditions). At run time the engine merges
    FRESH entity fields over the frozen event snapshot before evaluating, so
    "wait 2 days → if STILL open" works."""

    id: str = Field(default_factory=lambda: uuid.uuid4().hex, pattern=_NODE_ID_PATTERN)
    type: Literal["branch"]
    config: dict = Field(default_factory=dict)

    @field_validator("config")
    @classmethod
    def _validate_conditions(cls, v: dict) -> dict:
        groups = _normalize_condition_groups((v or {}).get("conditions"))
        validated = [[ConditionSpec(**c) for c in group] for group in groups]
        return {"conditions": [[c.model_dump() for c in group] for group in validated]}


GraphNode = Annotated[Union[BranchSpec, ActionSpec], Field(discriminator="type")]


class EdgeSpec(BaseModel):
    """A directed edge. `when` is null on ordinary edges; a branch node's
    outgoing edges carry "match" or "else"."""

    from_: str = Field(alias="from", pattern=_NODE_ID_PATTERN)
    to: str = Field(pattern=_NODE_ID_PATTERN)
    when: Optional[Literal["match", "else"]] = None

    model_config = {"populate_by_name": True}


class GraphSpec(BaseModel):
    """[FLOW4] The branched shape of `actions`. Structure (single root, acyclic,
    ≤ 25 nodes, branch edge discipline) is validated on write; wait placement
    and module/config completeness stay enable-time checks, like linear flows."""

    nodes: list[GraphNode] = Field(min_length=1, max_length=graph.MAX_NODES)
    edges: list[EdgeSpec] = Field(default_factory=list)

    def dump(self) -> dict:
        return {
            "nodes": [n.model_dump() for n in self.nodes],
            "edges": [e.model_dump(by_alias=True) for e in self.edges],
        }

    @model_validator(mode="after")
    def _validate_structure(self) -> "GraphSpec":
        graph.validate_graph(self.dump())  # raises ValueError → 422
        return self


# What FlowCreate/FlowUpdate accept for `actions`: the legacy/linear list (the
# modal builder, capped at 10) or the [FLOW4] graph (the canvas, capped at 25
# nodes). Stored as-is — the engine normalizes with graph.as_graph.
ActionsField = Union[GraphSpec, Annotated[list[ActionSpec], Field(max_length=10)]]


def dump_actions(actions: Union[GraphSpec, list[ActionSpec]]) -> Any:
    """The JSONB value the service stores for either accepted shape."""
    if isinstance(actions, GraphSpec):
        return actions.dump()
    return [a.model_dump() for a in actions]


class FlowCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    trigger_type: str
    # Accepts a flat list or grouped OR-of-AND; always stored grouped.
    conditions: list[list[ConditionSpec]] = Field(default_factory=list)
    actions: ActionsField = Field(default_factory=list)
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
    trigger_type: Optional[str] = None
    conditions: Optional[list[list[ConditionSpec]]] = None
    actions: Optional[ActionsField] = None
    enabled: Optional[bool] = None
    trigger_config: Optional[dict] = None

    @field_validator("trigger_type")
    @classmethod
    def _known_trigger(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            assert v in TRIGGER_META
        return v

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
    actions: Any  # linear list or [FLOW4] graph {"nodes", "edges"}
    run_count: int
    # From flow_runs (attached by the service): total success runs, and failed +
    # partial runs. Default 0 so a lone FlowOut (e.g. duplicate) stays valid.
    success_count: int = 0
    fail_count: int = 0
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
