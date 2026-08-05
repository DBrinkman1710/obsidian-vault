"""[KAN_FLOW1] Pipeline flowchart tests — schema validation + board reconciliation.

DB-free (same pattern as test_flows.py): the graph schemas and the
reconcile_flowchart helper are pure logic. The GET/PUT endpoints delegate their
whole two-way-sync behaviour to reconcile_flowchart, so exercising it directly
covers the reconciliation of a deleted stage and the unplaced-stage report.
"""
from datetime import datetime, timezone

import pytest
import uuid as _uuid

from app.modules.pipeline.schemas import (
    FlowchartEdge,
    FlowchartGraph,
    FlowchartNode,
    PipelineStageOut,
)
from app.modules.pipeline.service import reconcile_flowchart


def _stage(name="Lead", color="#5BA4F5", order=0) -> PipelineStageOut:
    return PipelineStageOut(
        id=_uuid.uuid4(),
        tenant_id=_uuid.uuid4(),
        name=name,
        color=color,
        display_order=order,
        created_at=datetime.now(timezone.utc),
        contact_count=0,
    )


# --------------------------------------------------------------- schema shape

def test_stage_node_requires_stage_id():
    with pytest.raises(Exception):
        FlowchartNode(id="n1", type="stage", x=0, y=0)  # no stage_id


def test_non_stage_node_rejects_stage_id():
    with pytest.raises(Exception):
        FlowchartNode(id="d1", type="decision", stage_id=_uuid.uuid4(), x=0, y=0)


def test_decision_start_end_nodes_are_valid():
    FlowchartNode(id="d1", type="decision", label="Replied?", x=1, y=2)
    FlowchartNode(id="s", type="start", x=0, y=0)
    FlowchartNode(id="e", type="end", x=0, y=0)


def test_graph_rejects_duplicate_node_ids():
    with pytest.raises(Exception):
        FlowchartGraph(
            nodes=[
                FlowchartNode(id="a", type="start", x=0, y=0),
                FlowchartNode(id="a", type="end", x=1, y=1),
            ],
            edges=[],
        )


def test_graph_rejects_edge_to_unknown_node():
    with pytest.raises(Exception):
        FlowchartGraph(
            nodes=[FlowchartNode(id="a", type="start", x=0, y=0)],
            edges=[FlowchartEdge(id="e1", source="a", target="ghost")],
        )


def test_empty_graph_is_valid():
    g = FlowchartGraph()
    assert g.nodes == [] and g.edges == []


# --------------------------------------------------------- reconciliation

def test_reconcile_reports_all_stages_unplaced_for_empty_chart():
    stages = [_stage("Lead"), _stage("Won")]
    out = reconcile_flowchart(FlowchartGraph(), stages)
    assert out.graph.nodes == []
    assert {s.id for s in out.unplaced_stages} == {s.id for s in stages}


def test_reconcile_drops_a_deleted_stage_node_and_its_edges():
    lead = _stage("Lead")
    won = _stage("Won")
    # Chart references both stages plus a decision, wired lead -> decision -> won.
    graph = FlowchartGraph(
        nodes=[
            FlowchartNode(id="n_lead", type="stage", stage_id=lead.id, x=0, y=0),
            FlowchartNode(id="d", type="decision", label="Replied?", x=1, y=0),
            FlowchartNode(id="n_won", type="stage", stage_id=won.id, x=2, y=0),
        ],
        edges=[
            FlowchartEdge(id="e1", source="n_lead", target="d"),
            FlowchartEdge(id="e2", source="d", target="n_won", label="yes"),
        ],
    )
    # The board deleted "Won" — only "Lead" survives.
    out = reconcile_flowchart(graph, [lead])

    node_ids = {n.id for n in out.graph.nodes}
    assert node_ids == {"n_lead", "d"}                 # deleted stage node dropped
    edge_ids = {e.id for e in out.graph.edges}
    assert edge_ids == {"e1"}                           # edge touching it dropped too
    # "Lead" is placed, so nothing is unplaced.
    assert out.unplaced_stages == []


def test_reconcile_lists_a_new_stage_as_unplaced():
    lead = _stage("Lead")
    fresh = _stage("Proposal")  # created on the board, no node yet
    graph = FlowchartGraph(
        nodes=[FlowchartNode(id="n_lead", type="stage", stage_id=lead.id, x=0, y=0)],
        edges=[],
    )
    out = reconcile_flowchart(graph, [lead, fresh])
    assert [s.id for s in out.unplaced_stages] == [fresh.id]
    assert {n.id for n in out.graph.nodes} == {"n_lead"}


# ══════════════════════════════════════════════════════════════
# [KAN_FLOW2] Feed the brain — serialiser + edge → suggestion mapping
# ══════════════════════════════════════════════════════════════

from app.modules.pipeline.flowchart_context import flowchart_to_text  # noqa: E402
from app.modules.pipeline.service import build_flowchart_suggestions  # noqa: E402


# Stable stage ids so KAN_FLOW2 assertions are deterministic.
_NEW = _uuid.uuid4()
_QUALIFIED = _uuid.uuid4()
_COLD = _uuid.uuid4()
_STAGE_NAMES = {_NEW: "New lead", _QUALIFIED: "Qualified", _COLD: "Cold"}


def _g(nodes, edges) -> FlowchartGraph:
    return FlowchartGraph.model_validate({"nodes": nodes, "edges": edges})


def _sn(node_id, stage_id):
    return {"id": node_id, "type": "stage", "stage_id": str(stage_id), "x": 0, "y": 0}


def _dn(node_id, label):
    return {"id": node_id, "type": "decision", "label": label, "x": 0, "y": 0}


# ------------------------------------------------------- flowchart_to_text

def test_kf2_text_direct_stage_to_stage():
    graph = _g([_sn("a", _NEW), _sn("b", _QUALIFIED)], [{"id": "e1", "source": "a", "target": "b"}])
    assert flowchart_to_text(graph, _STAGE_NAMES) == "New lead -> Qualified"


def test_kf2_text_uses_live_stage_names():
    graph = _g([_sn("a", _NEW), _sn("b", _QUALIFIED)], [{"id": "e1", "source": "a", "target": "b"}])
    renamed = {**_STAGE_NAMES, _NEW: "Fresh inbound"}
    assert flowchart_to_text(graph, renamed) == "Fresh inbound -> Qualified"


def test_kf2_text_decision_yes_no_and_free_label():
    graph = _g(
        [_sn("a", _NEW), _dn("d", "Replied?"), _sn("q", _QUALIFIED), _sn("c", _COLD)],
        [
            {"id": "e1", "source": "a", "target": "d"},
            {"id": "e2", "source": "d", "target": "q", "label": "yes"},
            {"id": "e3", "source": "d", "target": "c", "label": "no reply after 5 days"},
        ],
    )
    lines = set(flowchart_to_text(graph, _STAGE_NAMES).splitlines())
    assert "New lead -> [Replied?]" in lines
    assert "[Replied?] yes -> Qualified" in lines
    assert "[Replied?] -> Cold (no reply after 5 days)" in lines


def test_kf2_text_empty_when_no_edges():
    assert flowchart_to_text(_g([_sn("a", _NEW)], []), _STAGE_NAMES) == ""


# ------------------------------------------------ build_flowchart_suggestions

def test_kf2_suggestion_direct_edge():
    graph = _g([_sn("a", _NEW), _sn("b", _QUALIFIED)], [{"id": "e1", "source": "a", "target": "b"}])
    sugg = build_flowchart_suggestions(graph, _STAGE_NAMES)
    assert len(sugg) == 1
    s = sugg[0]
    assert s.source_stage_id == _NEW and s.target_stage_id == _QUALIFIED
    assert s.trigger_type == "pipeline_stage_changed"
    assert s.conditions == [{"field": "stage_id", "op": "equals", "value": str(_NEW)}]
    assert s.condition_description is None


def test_kf2_suggestion_via_decision_yes_no_branches():
    graph = _g(
        [_sn("a", _NEW), _dn("d", "Replied?"), _sn("q", _QUALIFIED), _sn("c", _COLD)],
        [
            {"id": "e1", "source": "a", "target": "d"},
            {"id": "e2", "source": "d", "target": "q", "label": "yes"},
            {"id": "e3", "source": "d", "target": "c", "label": "no"},
        ],
    )
    sugg = build_flowchart_suggestions(graph, _STAGE_NAMES)
    by_target = {s.target_stage_id: s for s in sugg}
    assert set(by_target) == {_QUALIFIED, _COLD}
    for s in sugg:
        assert s.source_stage_id == _NEW
        assert s.trigger_type == "pipeline_stage_changed"
        assert s.conditions == [{"field": "stage_id", "op": "equals", "value": str(_NEW)}]
    assert "Replied? is yes" in by_target[_QUALIFIED].condition_description
    assert "Replied? is no" in by_target[_COLD].condition_description


def test_kf2_suggestion_dedupes_and_skips_self_loop():
    graph = _g(
        [_sn("a", _NEW), _sn("a2", _NEW), _sn("b", _QUALIFIED)],
        [
            {"id": "e1", "source": "a", "target": "b"},
            {"id": "e2", "source": "a2", "target": "b"},  # same pair → deduped
            {"id": "e3", "source": "a", "target": "a2"},  # New → New → skipped
        ],
    )
    sugg = build_flowchart_suggestions(graph, _STAGE_NAMES)
    assert len(sugg) == 1
    assert sugg[0].source_stage_id == _NEW and sugg[0].target_stage_id == _QUALIFIED


def test_kf2_trigger_key_is_the_real_registered_one():
    # Guard against inventing a trigger — must match what pipeline declares.
    from app.modules.pipeline.flow_triggers import TRIGGERS

    assert "pipeline_stage_changed" in TRIGGERS
