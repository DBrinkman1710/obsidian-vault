from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


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
    days_in_stage: int = 0
    stale_alert: bool = False


class PipelineBoardColumn(BaseModel):
    stage: PipelineStageOut
    contacts: list[PipelineBoardContact]


class MoveToStage(BaseModel):
    stage_id: uuid.UUID


class BulkMoveToStage(BaseModel):
    contact_ids: list[uuid.UUID] = Field(min_length=1)
    stage_id: uuid.UUID


# ──────────────────────────────────────────────────────────────
# [KAN_FLOW1] Pipeline flowchart — nodes + labelled edges
# ──────────────────────────────────────────────────────────────

# A flowchart is intentionally capped so a single tenant chart stays bounded and
# cheap to persist/reason about. These mirror the flows-canvas node budget.
MAX_FLOWCHART_NODES = 100
MAX_FLOWCHART_EDGES = 200

FlowchartNodeType = Literal["stage", "decision", "start", "end"]


class FlowchartNode(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    type: FlowchartNodeType
    # Only stage nodes carry a stage_id; it must reference a real pipeline stage
    # (checked in the service against the live board, not here).
    stage_id: Optional[uuid.UUID] = None
    # Free text: the stage name is authoritative from the board, but decision
    # nodes store their question and start/end may carry a caption.
    label: Optional[str] = Field(default=None, max_length=280)
    x: float
    y: float

    @model_validator(mode="after")
    def _stage_nodes_need_a_stage(self) -> "FlowchartNode":
        # A stage node without a stage_id is meaningless — the board is the source
        # of truth, so a stage node must point at a real stage. Non-stage nodes
        # must NOT carry one.
        if self.type == "stage" and self.stage_id is None:
            raise ValueError("stage nodes must reference a stage via stage_id")
        if self.type != "stage" and self.stage_id is not None:
            raise ValueError("only stage nodes may set stage_id")
        return self


class FlowchartEdge(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    source: str = Field(min_length=1, max_length=64)
    target: str = Field(min_length=1, max_length=64)
    # Free text label, e.g. "yes", "no", "no reply after 5 days".
    label: Optional[str] = Field(default=None, max_length=280)


class FlowchartGraph(BaseModel):
    nodes: list[FlowchartNode] = Field(default_factory=list, max_length=MAX_FLOWCHART_NODES)
    edges: list[FlowchartEdge] = Field(default_factory=list, max_length=MAX_FLOWCHART_EDGES)

    @model_validator(mode="after")
    def _ids_are_unique_and_edges_resolve(self) -> "FlowchartGraph":
        node_ids = [n.id for n in self.nodes]
        if len(node_ids) != len(set(node_ids)):
            raise ValueError("duplicate node ids")
        edge_ids = [e.id for e in self.edges]
        if len(edge_ids) != len(set(edge_ids)):
            raise ValueError("duplicate edge ids")
        known = set(node_ids)
        for e in self.edges:
            if e.source not in known or e.target not in known:
                raise ValueError(f"edge {e.id} references an unknown node")
        return self


class FlowchartOut(BaseModel):
    """The stored graph plus the reconciliation the board drives: stages that
    have no node yet (so the UI can show them in the unplaced tray)."""
    graph: FlowchartGraph
    unplaced_stages: list[PipelineStageOut] = Field(default_factory=list)


# ──────────────────────────────────────────────────────────────
# [KAN_FLOW2] Automation suggestions derived from the chart
# ──────────────────────────────────────────────────────────────

class FlowchartSuggestion(BaseModel):
    """A draft automation suggestion mapped from one chart edge (stage → stage,
    directly or via a decision diamond). Shaped so the Flows UI can open its
    existing flow builder prefilled: ``trigger_type`` + ``conditions`` seed the
    trigger, and ``target_stage_id`` seeds a move_pipeline_stage action."""

    id: str
    title: str
    description: str
    # Human readable condition (the diamond's question + yes/no or free text
    # label), or None for a plain stage → stage arrow.
    condition_description: Optional[str] = None
    source_stage_id: uuid.UUID
    source_stage_name: str
    target_stage_id: uuid.UUID
    target_stage_name: str
    # Prefill payload for the Flows builder — matches the flows FlowCreate shape.
    trigger_type: str
    trigger_config: dict = Field(default_factory=dict)
    conditions: list[dict] = Field(default_factory=list)
