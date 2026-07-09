"""Flows module unit tests — condition evaluator + recipe/schema invariants.

DB-free (same pattern as test_smoke.py): everything here is pure logic.
"""
from datetime import datetime, timedelta

import pytest

from app.modules.flows import steps
from app.modules.flows.actions import ACTION_EXECUTORS, ACTION_META, ACTION_MODULES, render_placeholders
from app.modules.flows.conditions import TRIGGER_META, evaluate_condition, evaluate_conditions
from app.modules.flows.recipes import RECIPES, RECIPES_BY_KEY
from app.modules.flows.schemas import ActionSpec, ConditionSpec, FlowCreate, ScheduleConfigSpec
from app.modules.flows.service import FlowValidationError, _normalize_trigger_config


# --------------------------------------------------------------- conditions

def _cond(field, op, value):
    return {"field": field, "op": op, "value": value}


def test_equals_is_case_insensitive():
    assert evaluate_condition(_cond("priority", "equals", "High"), {"priority": "high"})
    assert not evaluate_condition(_cond("priority", "equals", "low"), {"priority": "high"})


def test_not_equals():
    assert evaluate_condition(_cond("status", "not_equals", "closed"), {"status": "open"})
    assert not evaluate_condition(_cond("status", "not_equals", "open"), {"status": "open"})


def test_missing_field_never_matches():
    for op in ("equals", "not_equals", "contains", "in", "gte", "lte"):
        assert not evaluate_condition(_cond("nope", op, "x"), {"priority": "high"})


def test_contains_on_string_and_list():
    assert evaluate_condition(_cond("subject", "contains", "Invoice"), {"subject": "invoice INV-1 wrong"})
    assert not evaluate_condition(_cond("subject", "contains", "refund"), {"subject": "invoice wrong"})
    assert evaluate_condition(_cond("tags", "contains", "VIP"), {"tags": ["vip", "lead"]})
    assert not evaluate_condition(_cond("tags", "contains", "churned"), {"tags": ["vip"]})


def test_in_op():
    assert evaluate_condition(_cond("priority", "in", ["high", "urgent"]), {"priority": "Urgent"})
    assert not evaluate_condition(_cond("priority", "in", ["high", "urgent"]), {"priority": "low"})
    # non-list expected value never matches
    assert not evaluate_condition(_cond("priority", "in", "high"), {"priority": "high"})


def test_gte_lte():
    assert evaluate_condition(_cond("score", "gte", 40), {"score": 40})
    assert evaluate_condition(_cond("score", "lte", "50"), {"score": 40})
    assert not evaluate_condition(_cond("score", "gte", 41), {"score": 40})
    # non-numeric values never match
    assert not evaluate_condition(_cond("subject", "gte", 5), {"subject": "hello"})


def test_unknown_op_never_matches():
    assert not evaluate_condition(_cond("priority", "matches", "high"), {"priority": "high"})


def test_and_semantics_and_empty_list():
    fields = {"priority": "high", "status": "open"}
    assert evaluate_conditions([], fields)
    assert evaluate_conditions(
        [_cond("priority", "equals", "high"), _cond("status", "equals", "open")], fields
    )
    assert not evaluate_conditions(
        [_cond("priority", "equals", "high"), _cond("status", "equals", "closed")], fields
    )


# ------------------------------------------------------- [FLOW2] OR groups

def test_or_groups_semantics():
    fields = {"priority": "high", "status": "closed"}
    # (priority=high AND status=open) OR (priority=high) → second group matches
    assert evaluate_conditions(
        [[_cond("priority", "equals", "high"), _cond("status", "equals", "open")],
         [_cond("priority", "equals", "high")]],
        fields,
    )
    # (status=open) OR (priority=low) → neither group matches
    assert not evaluate_conditions(
        [[_cond("status", "equals", "open")], [_cond("priority", "equals", "low")]],
        fields,
    )
    # single group behaves like AND
    assert not evaluate_conditions(
        [[_cond("priority", "equals", "high"), _cond("status", "equals", "open")]],
        fields,
    )


def test_flat_list_is_backward_compatible():
    """A legacy flat list evaluates identically to a single-group nested list."""
    fields = {"priority": "high", "status": "open"}
    flat = [_cond("priority", "equals", "high"), _cond("status", "equals", "open")]
    assert evaluate_conditions(flat, fields) == evaluate_conditions([flat], fields)


# ------------------------------------------------------------- placeholders

def test_render_placeholders():
    fields = {"subject": "Broken invoice", "tags": ["vip", "lead"]}
    assert render_placeholders("Re: {subject}", fields) == "Re: Broken invoice"
    assert render_placeholders("Tags: {tags}", fields) == "Tags: vip, lead"
    # unknown keys stay literal, None body is safe
    assert render_placeholders("Hi {unknown}", fields) == "Hi {unknown}"
    assert render_placeholders(None, fields) == ""


# ------------------------------------------------------ registry invariants

def test_every_action_has_executor_meta_and_module_entry():
    # "wait" is a pseudo action: it has meta + a module entry but no executor
    # (the engine special-cases it).
    assert set(ACTION_MODULES) == set(ACTION_META)
    assert set(ACTION_EXECUTORS) == set(ACTION_META) - {"wait"}


def test_every_trigger_has_label_module_and_fields():
    for key, meta in TRIGGER_META.items():
        assert meta["label"]
        assert "module" in meta
        assert isinstance(meta["fields"], list)
        # every trigger declares fields EXCEPT free-field triggers ([FLOW5]
        # webhook), whose payload keys are unknown until data arrives
        assert meta["fields"] or meta.get("free_fields")


# ------------------------------------------------------------------ recipes

def test_recipes_are_unique_and_indexed():
    keys = [r["key"] for r in RECIPES]
    assert len(keys) == len(set(keys))
    assert set(RECIPES_BY_KEY) == set(keys)


def test_recipes_validate_against_schemas():
    """Every recipe must parse as a (draft) FlowCreate — same path the API uses."""
    for recipe in RECIPES:
        flow = FlowCreate(
            name=recipe["name"],
            trigger_type=recipe["trigger_type"],
            conditions=[ConditionSpec(**c) for c in recipe["conditions"]],
            actions=[ActionSpec(**a) for a in recipe["actions"]],
            enabled=False,
        )
        assert flow.trigger_type in TRIGGER_META
        for action in flow.actions:
            assert action.type in ACTION_EXECUTORS


def test_action_config_whitelist_drops_unknown_keys():
    spec = ActionSpec(type="notify_user", config={
        "user_id": "u", "message": "m", "evil_extra": "x", "empty": "",
    })
    assert spec.config == {"user_id": "u", "message": "m"}


def test_flow_create_rejects_unknown_trigger_and_action():
    with pytest.raises(Exception):
        FlowCreate(name="x", trigger_type="nope", actions=[])
    with pytest.raises(Exception):
        ActionSpec(type="rm_rf", config={})


# ------------------------------------------- [FLOW2] condition group schemas

def test_flow_create_normalizes_flat_conditions_to_one_group():
    flow = FlowCreate(
        name="x",
        trigger_type="ticket_created",
        conditions=[_cond("priority", "equals", "high")],
        enabled=False,
    )
    # stored grouped: [[{...}]]
    assert len(flow.conditions) == 1
    assert len(flow.conditions[0]) == 1
    assert flow.conditions[0][0].field == "priority"


def test_flow_create_accepts_grouped_conditions():
    flow = FlowCreate(
        name="x",
        trigger_type="ticket_created",
        conditions=[[_cond("priority", "equals", "high")],
                    [_cond("channel", "equals", "email")]],
        enabled=False,
    )
    assert len(flow.conditions) == 2


def test_flow_create_empty_conditions_stay_empty():
    flow = FlowCreate(name="x", trigger_type="ticket_created", conditions=[], enabled=False)
    assert flow.conditions == []


def test_flow_create_rejects_depth_three():
    with pytest.raises(Exception):
        FlowCreate(
            name="x", trigger_type="ticket_created",
            conditions=[[[_cond("priority", "equals", "high")]]],
            enabled=False,
        )


def test_flow_create_rejects_empty_group():
    with pytest.raises(Exception):
        FlowCreate(
            name="x", trigger_type="ticket_created",
            conditions=[[_cond("priority", "equals", "high")], []],
            enabled=False,
        )


def test_flow_create_rejects_too_many_groups():
    with pytest.raises(Exception):
        FlowCreate(
            name="x", trigger_type="ticket_created",
            conditions=[[_cond("priority", "equals", "high")] for _ in range(6)],
            enabled=False,
        )


def test_flow_create_rejects_mixed_flat_and_grouped():
    with pytest.raises(Exception):
        FlowCreate(
            name="x", trigger_type="ticket_created",
            conditions=[_cond("priority", "equals", "high"),
                        [_cond("channel", "equals", "email")]],
            enabled=False,
        )


# ------------------------------------------------------ [FLOW2] wait steps

def test_wait_delta_accepts_one_valid_unit():
    assert steps.wait_delta({"minutes": 30}) == timedelta(minutes=30)
    assert steps.wait_delta({"hours": 2}) == timedelta(hours=2)
    assert steps.wait_delta({"days": 30}) == timedelta(days=30)
    # string amounts (the config round-trips through JSON) coerce cleanly
    assert steps.wait_delta({"hours": "3"}) == timedelta(hours=3)


def test_wait_delta_rejects_bad_configs():
    for bad in ({}, {"hours": 0}, {"hours": -1}, {"minutes": 1, "hours": 1},
                {"weeks": 1}, {"hours": True}, {"hours": "soon"}, {"days": 31}):
        with pytest.raises(ValueError):
            steps.wait_delta(bad)


def test_total_wait_days_sums_only_waits():
    actions = [
        {"type": "wait", "config": {"days": 5}},
        {"type": "notify_user", "config": {}},
        {"type": "wait", "config": {"hours": 12}},
    ]
    assert steps.total_wait_days(actions) == pytest.approx(5.5)


def test_validate_wait_placement():
    steps.validate_wait_placement([
        {"type": "wait", "config": {"hours": 1}},
        {"type": "notify_user", "config": {}},
    ])  # ok: wait not trailing, under cap
    with pytest.raises(ValueError):  # trailing wait
        steps.validate_wait_placement([
            {"type": "notify_user", "config": {}},
            {"type": "wait", "config": {"hours": 1}},
        ])
    with pytest.raises(ValueError):  # total over 30 days
        steps.validate_wait_placement([
            {"type": "wait", "config": {"days": 20}},
            {"type": "wait", "config": {"days": 15}},
            {"type": "notify_user", "config": {}},
        ])


def test_action_spec_validates_wait_config():
    ok = ActionSpec(type="wait", config={"hours": 2, "evil": "x"})
    assert ok.config == {"hours": 2}  # whitelist drops unknown keys
    with pytest.raises(Exception):  # no unit
        ActionSpec(type="wait", config={})
    with pytest.raises(Exception):  # two units
        ActionSpec(type="wait", config={"hours": 1, "days": 1})


def test_flow_create_accepts_wait_and_higher_action_cap():
    flow = FlowCreate(
        name="drip",
        trigger_type="contact_created",
        actions=[
            ActionSpec(type="notify_user", config={"user_id": "u", "message": "hi"}),
            ActionSpec(type="wait", config={"days": 1}),
            ActionSpec(type="notify_user", config={"user_id": "u", "message": "still here"}),
        ],
        enabled=False,
    )
    assert [a.type for a in flow.actions] == ["notify_user", "wait", "notify_user"]
    # cap raised from 5 to 10
    with pytest.raises(Exception):
        FlowCreate(name="x", trigger_type="contact_created",
                   actions=[ActionSpec(type="notify_user", config={}) for _ in range(11)],
                   enabled=False)


def test_wait_is_meta_only_no_executor():
    assert "wait" in ACTION_META
    assert ACTION_MODULES["wait"] is None
    assert "wait" not in ACTION_EXECUTORS


# ------------------------------------------------------ [FLOW2] run status

def test_derive_run_status_matrix():
    ok = {"ok": True, "skipped": False}
    skip = {"ok": False, "skipped": True}
    fail = {"ok": False, "skipped": False}
    assert steps.derive_run_status([ok, ok]) == "success"
    assert steps.derive_run_status([fail, fail]) == "failed"
    assert steps.derive_run_status([ok, fail]) == "partial"
    assert steps.derive_run_status([ok, skip]) == "partial"
    assert steps.derive_run_status([skip, skip]) == "partial"


# ---------------------------------------------------------- [FLOW2] retries

def test_retry_delay_ladder():
    assert steps.retry_delay(1) == timedelta(seconds=60)
    assert steps.retry_delay(2) == timedelta(seconds=300)
    assert steps.retry_delay(3) is None
    assert steps.retry_delay(0) is None
    assert steps.MAX_ATTEMPTS == 3


# -------------------------------------------------------- [FLOW2] schedule

def _dt(day, hour, minute=0):
    # 2026-07-06 is a Monday (weekday 0)
    return datetime(2026, 7, 6 + day, hour, minute)


def test_schedule_is_due_daily():
    cfg = {"frequency": "daily", "time": "09:00"}
    assert not steps.schedule_is_due(cfg, _dt(0, 8, 59), None)  # before time
    assert steps.schedule_is_due(cfg, _dt(0, 9, 0), None)       # at time
    assert steps.schedule_is_due(cfg, _dt(0, 18, 0), None)      # missed tick, same day self-heal
    # already fired today
    assert not steps.schedule_is_due(cfg, _dt(0, 18, 0), "2026-07-06")
    # fired yesterday → due again today
    assert steps.schedule_is_due(cfg, _dt(1, 9, 0), "2026-07-06")


def test_schedule_is_due_weekly_needs_weekday():
    cfg = {"frequency": "weekly", "time": "09:00", "weekday": 0}  # Monday
    assert steps.schedule_is_due(cfg, _dt(0, 9, 0), None)   # Monday
    assert not steps.schedule_is_due(cfg, _dt(1, 9, 0), None)  # Tuesday
    # weekly without a weekday never fires
    assert not steps.schedule_is_due({"frequency": "weekly", "time": "09:00"}, _dt(0, 9, 0), None)


def test_schedule_is_due_rejects_bad_config():
    assert not steps.schedule_is_due({}, _dt(0, 9, 0), None)
    assert not steps.schedule_is_due({"frequency": "hourly", "time": "09:00"}, _dt(0, 9, 0), None)
    assert not steps.schedule_is_due({"frequency": "daily", "time": "nope"}, _dt(0, 9, 0), None)


# --------------------------------------------- [FLOW2C] schedule config schema

def test_schedule_config_daily_drops_weekday():
    cfg = ScheduleConfigSpec(frequency="daily", time="09:00", weekday=3)
    assert cfg.model_dump() == {"frequency": "daily", "time": "09:00", "weekday": None}


def test_schedule_config_weekly_needs_weekday():
    assert ScheduleConfigSpec(frequency="weekly", time="09:00", weekday=0).weekday == 0
    with pytest.raises(Exception):  # weekly with no weekday
        ScheduleConfigSpec(frequency="weekly", time="09:00")


def test_schedule_config_rejects_bad_time():
    for bad in ("9:00", "24:00", "09:60", "nope", ""):
        with pytest.raises(Exception):
            ScheduleConfigSpec(frequency="daily", time=bad)


def test_normalize_trigger_config_non_schedule_drops_config():
    # any trigger that isn't `schedule` stores an empty config, always
    assert _normalize_trigger_config("ticket_created", {"frequency": "daily"}, enabled=True) == {}
    assert _normalize_trigger_config("ticket_sla_due_soon", {"x": 1}, enabled=False) == {}


def test_normalize_trigger_config_schedule_validates_and_normalizes():
    out = _normalize_trigger_config("schedule", {"frequency": "daily", "time": "08:30"}, enabled=True)
    assert out == {"frequency": "daily", "time": "08:30", "weekday": None}


def test_normalize_trigger_config_draft_schedule_may_be_empty():
    assert _normalize_trigger_config("schedule", {}, enabled=False) == {}
    assert _normalize_trigger_config("schedule", None, enabled=False) == {}


def test_normalize_trigger_config_enabled_schedule_requires_valid():
    with pytest.raises(FlowValidationError):
        _normalize_trigger_config("schedule", {}, enabled=True)
    with pytest.raises(FlowValidationError):  # weekly missing weekday
        _normalize_trigger_config("schedule", {"frequency": "weekly", "time": "09:00"}, enabled=True)


def test_schedule_and_sla_triggers_registered():
    assert "schedule" in TRIGGER_META and TRIGGER_META["schedule"]["module"] is None
    assert TRIGGER_META["ticket_sla_due_soon"]["module"] == "tickets"


# ------------------------------------------------ [FLOW-POLISH] test fire (dry run)

from app.modules.flows import preview


def test_build_sample_event_uses_condition_values_and_defaults():
    fields = preview.build_sample_event(
        "ticket_created",
        [[_cond("priority", "equals", "urgent")]],
    )
    # condition value wins for its field
    assert fields["priority"] == "urgent"
    # uncovered trigger fields get a default (first option / marker text)
    assert fields["channel"] == "manual"     # first option of the select
    assert fields["subject"] == "sample"     # text marker
    assert fields["event_type"] == "ticket_created"


def test_build_sample_event_satisfies_in_and_not_equals():
    fields = preview.build_sample_event(
        "ticket_status_changed",
        [[_cond("status", "in", ["resolved", "closed"]),
          _cond("priority", "not_equals", "low")]],
    )
    assert fields["status"] == "resolved"          # first of the `in` list
    assert fields["priority"] != "low"             # not_equals is satisfied


def test_dry_run_happy_path_matches_and_runs_actions():
    result = preview.dry_run(
        "ticket_created",
        [[_cond("priority", "equals", "high")]],
        [{"type": "create_ticket", "config": {"subject": "Re: {subject}"}}],
        ["tickets"],
    )
    assert result["matched"] is True
    assert "event_type" not in result["sample_event"]
    action = result["actions"][0]
    assert action["would_run"] is True and action["reason"] is None
    assert action["detail"] == "Create a ticket “Re: sample”"


def test_dry_run_contradictory_conditions_do_not_match():
    # equals high AND equals low on the same field can't both hold in one group
    result = preview.dry_run(
        "ticket_created",
        [[_cond("priority", "equals", "high"), _cond("priority", "equals", "low")]],
        [{"type": "notify_user", "config": {"user_id": "u", "message": "hi"}}],
        [],
    )
    assert result["matched"] is False
    action = result["actions"][0]
    assert action["would_run"] is False
    assert "did not match" in action["reason"]


def test_dry_run_marks_disabled_module_action_as_skipped():
    # conditions match, but the action's module isn't enabled → would not run
    result = preview.dry_run(
        "contact_created",
        [],
        [{"type": "send_email", "config": {"subject": "Hi"}}],
        [],  # inbox not enabled
    )
    assert result["matched"] is True
    action = result["actions"][0]
    assert action["would_run"] is False
    assert "inbox" in action["reason"]


def test_dry_run_or_group_matches_when_any_group_satisfied():
    result = preview.dry_run(
        "ticket_created",
        [[_cond("priority", "equals", "high")], [_cond("channel", "equals", "email")]],
        [{"type": "notify_user", "config": {"user_id": "u", "message": "go"}}],
        [],
    )
    # both groups' fields are synthesized to satisfy them → matches
    assert result["matched"] is True


def test_preview_wait_detail():
    result = preview.dry_run(
        "contact_created", [],
        [{"type": "wait", "config": {"hours": 2}},
         {"type": "notify_user", "config": {"user_id": "u", "message": "later"}}],
        [],
    )
    assert result["actions"][0]["detail"] == "Pause the flow for 2 hours"
    assert result["actions"][1]["detail"] == "Notify a team member: “later”"


# ------------------------------------------------------- [FLOW3] action ids

def test_action_spec_mints_an_id_when_missing():
    spec = ActionSpec(type="notify_user", config={"user_id": "u1", "message": "hi"})
    assert spec.id
    assert len(spec.id) <= 36
    assert spec.model_dump()["id"] == spec.id


def test_action_spec_preserves_a_provided_id():
    spec = ActionSpec(id="abc_123", type="wait", config={"hours": 2})
    assert spec.id == "abc_123"


def test_action_spec_rejects_a_malformed_id():
    for bad in ("", "has space", "x" * 37, "semi;colon"):
        with pytest.raises(Exception):
            ActionSpec(id=bad, type="wait", config={"hours": 1})


def test_flow_create_actions_each_get_a_unique_id():
    flow = FlowCreate(
        name="f",
        trigger_type="ticket_created",
        actions=[
            {"type": "notify_user", "config": {"user_id": "u", "message": "a"}},
            {"type": "notify_user", "config": {"user_id": "u", "message": "b"}},
        ],
    )
    ids = [a.id for a in flow.actions]
    assert all(ids)
    assert len(set(ids)) == 2


def test_flow_create_round_trips_client_ids():
    flow = FlowCreate(
        name="f",
        trigger_type="ticket_created",
        actions=[{"id": "client_id_1", "type": "wait", "config": {"minutes": 5}},
                 {"id": "client_id_2", "type": "notify_user",
                  "config": {"user_id": "u", "message": "m"}}],
    )
    assert [a.model_dump()["id"] for a in flow.actions] == ["client_id_1", "client_id_2"]


# ------------------------------------------------- [FLOW4] branching graphs

from app.modules.flows import graph
from app.modules.flows.schemas import GraphSpec, dump_actions


def _n(node_id, node_type="notify_user", **config):
    return {"id": node_id, "type": node_type, "config": config}


def _b(node_id, conditions):
    return {"id": node_id, "type": "branch", "config": {"conditions": conditions}}


def _e(source, target, when=None):
    return {"from": source, "to": target, "when": when}


# A well-formed branch graph: notify → branch → (match: escalate | else: close).
def _branch_graph():
    return {
        "nodes": [
            _n("start", "notify_user", user_id="u", message="new"),
            _b("check", [[_cond("status", "equals", "open")]]),
            _n("escalate", "update_ticket", priority="urgent"),
            _n("close", "update_ticket", status="closed"),
        ],
        "edges": [
            _e("start", "check"),
            _e("check", "escalate", "match"),
            _e("check", "close", "else"),
        ],
    }


def test_as_graph_normalizes_a_list_to_one_chain():
    actions = [
        {"id": "a1", "type": "notify_user", "config": {}},
        {"type": "wait", "config": {"days": 1}},  # legacy: no id
        {"id": "a3", "type": "send_email", "config": {}},
    ]
    g = graph.as_graph(actions)
    ids = [n["id"] for n in g["nodes"]]
    assert ids == ["a1", "pos:1", "a3"]
    assert g["edges"] == [
        {"from": "a1", "to": "pos:1", "when": None},
        {"from": "pos:1", "to": "a3", "when": None},
    ]
    # synthetic chain ids are never stamped into run results
    assert graph.result_action_id(g["nodes"][0]) == "a1"
    assert graph.result_action_id(g["nodes"][1]) is None
    # a graph passes through untouched
    assert graph.as_graph(_branch_graph()) == _branch_graph()


def test_graph_root_and_next_id_routing():
    g = _branch_graph()
    assert graph.root_id(g) == "start"
    assert graph.next_id(g, "start") == "check"
    assert graph.next_id(g, "check", matched=True) == "escalate"
    assert graph.next_id(g, "check", matched=False) == "close"
    assert graph.next_id(g, "escalate") is None


def test_validate_graph_accepts_a_branch_shape():
    graph.validate_graph(_branch_graph())  # must not raise
    # a branch may omit its else path (no match → the flow just ends)
    g = _branch_graph()
    g["nodes"] = g["nodes"][:3]
    g["edges"] = g["edges"][:2]
    graph.validate_graph(g)


def test_validate_graph_rejects_bad_structures():
    cases = [
        # two roots (b disconnected from the chain)
        {"nodes": [_n("a"), _n("b")], "edges": []},
        # cycle (no root left)
        {"nodes": [_n("a"), _n("b")], "edges": [_e("a", "b"), _e("b", "a")]},
        # cycle behind a valid root (exercises the Kahn check, not the root rule)
        {"nodes": [_n("a"), _n("b"), _n("c")],
         "edges": [_e("a", "b"), _e("b", "c"), _e("c", "b")]},
        # self loop
        {"nodes": [_n("a")], "edges": [_e("a", "a")]},
        # dangling edge target
        {"nodes": [_n("a")], "edges": [_e("a", "ghost")]},
        # duplicate ids
        {"nodes": [_n("a"), _n("a")], "edges": []},
        # non-branch node with two outgoing edges
        {"nodes": [_n("a"), _n("b"), _n("c")], "edges": [_e("a", "b"), _e("a", "c")]},
        # non-branch edge carrying a branch label
        {"nodes": [_n("a"), _n("b")], "edges": [_e("a", "b", "match")]},
        # branch edge without a label
        {"nodes": [_b("a", []), _n("b")], "edges": [_e("a", "b")]},
        # branch with two match edges
        {"nodes": [_b("a", []), _n("b"), _n("c")],
         "edges": [_e("a", "b", "match"), _e("a", "c", "match")]},
        # branch with no outgoing path at all
        {"nodes": [_n("a"), _b("check", [])], "edges": [_e("a", "check")]},
        # empty graph
        {"nodes": [], "edges": []},
    ]
    for bad in cases:
        with pytest.raises(ValueError):
            graph.validate_graph(bad)
    with pytest.raises(ValueError):  # over the node cap
        graph.validate_graph(graph.as_graph(
            [{"id": f"n{i}", "type": "notify_user", "config": {}} for i in range(26)]
        ))


def test_total_wait_days_takes_the_longest_path():
    g = {
        "nodes": [
            _b("check", []),
            _n("short_wait", "wait", days=5),
            _n("long_wait", "wait", days=20),
            _n("after_short"),
            _n("after_long"),
        ],
        "edges": [
            _e("check", "short_wait", "match"),
            _e("check", "long_wait", "else"),
            _e("short_wait", "after_short"),
            _e("long_wait", "after_long"),
        ],
    }
    assert graph.total_wait_days(g) == pytest.approx(20)
    # a linear list is its own longest path — phase 2 behaviour unchanged
    assert steps.total_wait_days([
        {"type": "wait", "config": {"days": 5}},
        {"type": "notify_user", "config": {}},
        {"type": "wait", "config": {"hours": 12}},
    ]) == pytest.approx(5.5)


def test_validate_wait_placement_is_graph_aware():
    # a wait may not END any path
    with pytest.raises(ValueError):
        graph.validate_wait_placement({
            "nodes": [_b("check", []), _n("w", "wait", days=1), _n("done")],
            "edges": [_e("check", "w", "match"), _e("check", "done", "else")],
        })
    # 16 + 15 days on the SAME path breaches the cap …
    with pytest.raises(ValueError):
        graph.validate_wait_placement(graph.as_graph([
            _n("w1", "wait", days=16), _n("w2", "wait", days=15), _n("done"),
        ]))
    # … but split across two legs each path stays under it
    graph.validate_wait_placement({
        "nodes": [_b("check", []), _n("w1", "wait", days=16), _n("w2", "wait", days=15),
                  _n("a"), _n("b")],
        "edges": [_e("check", "w1", "match"), _e("check", "w2", "else"),
                  _e("w1", "a"), _e("w2", "b")],
    })


def test_flow_create_accepts_a_graph_and_normalizes_branch_conditions():
    flow = FlowCreate(
        name="branching",
        trigger_type="ticket_created",
        actions=_branch_graph(),
        enabled=False,
    )
    assert isinstance(flow.actions, GraphSpec)
    stored = dump_actions(flow.actions)
    # edges keep the stored "from" key (Python-keyword alias round-trips)
    assert stored["edges"][0]["from"] == "start"
    # branch conditions are normalized to grouped OR-of-AND, like flow conditions
    check = next(n for n in stored["nodes"] if n["id"] == "check")
    assert check["config"]["conditions"] == [[_cond("status", "equals", "open")]]


def test_flow_create_rejects_a_cyclic_graph():
    g = _branch_graph()
    g["edges"].append(_e("escalate", "start"))
    with pytest.raises(Exception):
        FlowCreate(name="x", trigger_type="ticket_created", actions=g, enabled=False)


def test_branch_spec_rejects_a_bad_condition_op():
    bad = _branch_graph()
    bad["nodes"][1] = _b("check", [[{"field": "status", "op": "regex", "value": ".*"}]])
    with pytest.raises(Exception):
        FlowCreate(name="x", trigger_type="ticket_created", actions=bad, enabled=False)


def test_dump_actions_keeps_the_linear_list_shape():
    flow = FlowCreate(
        name="linear", trigger_type="contact_created",
        actions=[{"id": "a1", "type": "notify_user", "config": {"user_id": "u", "message": "m"}}],
        enabled=False,
    )
    stored = dump_actions(flow.actions)
    assert isinstance(stored, list)
    assert stored[0]["id"] == "a1"


def test_preview_graph_walks_the_sample_path():
    # flow-level condition biases the sample to priority=high → branch matches → escalate leg
    result = preview.dry_run(
        "ticket_created",
        [[_cond("priority", "equals", "high")]],
        {
            "nodes": [
                _b("check", [[_cond("priority", "equals", "high")]]),
                _n("escalate", "update_ticket", priority="urgent"),
                _n("close", "update_ticket", status="closed"),
            ],
            "edges": [_e("check", "escalate", "match"), _e("check", "close", "else")],
        },
        ["tickets"],
    )
    types = [a["type"] for a in result["actions"]]
    assert types == ["branch", "update_ticket"]
    assert "match path" in result["actions"][0]["detail"]
    assert result["actions"][1]["would_run"] is True

    # flip the condition so the sample takes the else leg instead
    result = preview.dry_run(
        "ticket_created",
        [[_cond("priority", "equals", "low")]],
        {
            "nodes": [
                _b("check", [[_cond("priority", "equals", "high")]]),
                _n("escalate", "update_ticket", priority="urgent"),
                _n("close", "update_ticket", status="closed"),
            ],
            "edges": [_e("check", "escalate", "match"), _e("check", "close", "else")],
        },
        ["tickets"],
    )
    assert [a["type"] for a in result["actions"]] == ["branch", "update_ticket"]
    assert "else path" in result["actions"][0]["detail"]


# ------------------------------------------------------------- [FLOW5] webhooks

from app.modules.flows import webhooks
from app.modules.flows.webhooks import WebhookError


def test_flatten_payload_keeps_scalars_and_flat_lists():
    body = {
        "name": "Ada",
        "count": 3,
        "flag": True,
        "empty": None,
        "tags": ["vip", "eu"],
        "nested": {"a": 1},          # dropped — not a flat value
        "matrix": [[1, 2], [3]],     # dropped — list of lists
        7: "int key",                # dropped — non-string key
    }
    fields = webhooks.flatten_payload(body)
    assert fields == {"name": "Ada", "count": 3, "flag": True, "empty": None, "tags": ["vip", "eu"]}


def test_flatten_payload_non_dict_and_cap():
    assert webhooks.flatten_payload([1, 2, 3]) == {}
    assert webhooks.flatten_payload("nope") == {}
    big = {f"k{i}": i for i in range(100)}
    assert len(webhooks.flatten_payload(big, cap=10)) == 10


def test_sign_payload_is_deterministic_hmac():
    sig = webhooks.sign_payload("s3cret", b'{"a":1}')
    assert sig.startswith("sha256=")
    # same input → same signature; different secret → different
    assert sig == webhooks.sign_payload("s3cret", b'{"a":1}')
    assert sig != webhooks.sign_payload("other", b'{"a":1}')


def test_is_blocked_ip():
    for blocked in ("127.0.0.1", "10.0.0.1", "192.168.1.1", "169.254.169.254", "::1", "0.0.0.0", "not-an-ip"):
        assert webhooks._is_blocked_ip(blocked), blocked
    for ok in ("93.184.216.34", "1.1.1.1", "2606:4700:4700::1111"):
        assert not webhooks._is_blocked_ip(ok), ok


def test_validate_target_rejects_bad_scheme_and_private():
    with pytest.raises(WebhookError):
        webhooks.validate_target("ftp://example.com/hook")
    with pytest.raises(WebhookError):
        webhooks.validate_target("file:///etc/passwd")
    # IP literals resolve without network — a private/metadata target is blocked
    with pytest.raises(WebhookError):
        webhooks.validate_target("http://127.0.0.1/hook")
    with pytest.raises(WebhookError):
        webhooks.validate_target("http://169.254.169.254/latest/meta-data")


def test_validate_target_allows_public_ip_literal():
    url, host, ip = webhooks.validate_target("https://93.184.216.34/hook")
    assert host == "93.184.216.34"
    assert ip == "93.184.216.34"
    assert url.scheme == "https"


# ---------------------------------------------- webhook trigger + send_webhook

def test_webhook_trigger_registered_with_free_fields():
    meta = TRIGGER_META["webhook"]
    assert meta["module"] is None
    assert meta["free_fields"] is True
    assert meta["fields"] == []


def test_send_webhook_action_registered():
    assert "send_webhook" in ACTION_META
    assert ACTION_MODULES["send_webhook"] is None       # no internal module gate
    assert "send_webhook" in ACTION_EXECUTORS
    keys = {f["key"] for f in ACTION_META["send_webhook"]["config_fields"]}
    assert keys == {"url"}


def test_flow_create_accepts_webhook_trigger_and_send_webhook():
    flow = FlowCreate(
        name="ERP bridge",
        trigger_type="webhook",
        conditions=[[_cond("order_status", "equals", "shipped")]],
        actions=[{"type": "send_webhook", "config": {"url": "https://example.com/hook"}}],
        enabled=False,
    )
    assert flow.trigger_type == "webhook"
    assert flow.actions[0].type == "send_webhook"
    assert flow.actions[0].config == {"url": "https://example.com/hook"}


def test_webhook_trigger_config_is_dropped():
    # webhook, like the mutation triggers, carries no trigger_config
    assert _normalize_trigger_config("webhook", {"anything": 1}, enabled=True) == {}


def test_dry_run_webhook_uses_free_condition_fields():
    from app.modules.flows import preview

    result = preview.dry_run(
        "webhook",
        [[_cond("order_status", "equals", "shipped")]],
        [{"type": "send_webhook", "config": {"url": "https://example.com/{order_status}"}}],
        [],
    )
    # the sample is biased to satisfy the condition, so the flow matches
    assert result["sample_event"]["order_status"] == "shipped"
    assert result["matched"] is True
    assert result["actions"][0]["would_run"] is True
    assert "example.com/shipped" in result["actions"][0]["detail"]


# ------------------------------------------------------------ [FLOW6] chaining

def test_chain_of_reads_fresh_and_garbled_fields_as_a_new_chain():
    assert steps.chain_of({}) == (0, [])
    assert steps.chain_of(None) == (0, [])
    # payloads round-trip through JSONB and external webhook callers — garbage
    # must never crash the engine, it just reads as depth 0
    assert steps.chain_of({"chain_depth": "nope", "chain_path": "not-a-list"}) == (0, [])
    assert steps.chain_of({"chain_depth": None, "chain_path": None}) == (0, [])


def test_chain_of_reads_a_real_chain():
    depth, path = steps.chain_of({"chain_depth": 2, "chain_path": ["a", "b"]})
    assert depth == 2
    assert path == ["a", "b"]


def test_next_chain_goes_one_link_deeper_and_appends_the_flow():
    chain = steps.next_chain({}, "flow-1")
    assert chain == {"depth": 1, "path": ["flow-1"]}
    chain = steps.next_chain({"chain_depth": 1, "chain_path": ["flow-1"]}, "flow-2")
    assert chain == {"depth": 2, "path": ["flow-1", "flow-2"]}


def test_chain_allows_requires_the_opt_in():
    # phase 1 behaviour is the default: no chainable flag → never fires on
    # flow-caused events
    assert not steps.chain_allows({}, {}, "flow-2")
    assert not steps.chain_allows(None, {}, "flow-2")
    assert not steps.chain_allows({"chainable": False}, {}, "flow-2")
    assert steps.chain_allows(
        {"chainable": True}, {"chain_depth": 1, "chain_path": ["flow-1"]}, "flow-2"
    )


def test_chain_allows_enforces_the_depth_cap():
    config = {"chainable": True}
    at_cap = {"chain_depth": steps.MAX_CHAIN_DEPTH, "chain_path": ["a", "b", "c"]}
    below_cap = {"chain_depth": steps.MAX_CHAIN_DEPTH - 1, "chain_path": ["a", "b"]}
    assert not steps.chain_allows(config, at_cap, "flow-9")
    assert steps.chain_allows(config, below_cap, "flow-9")


def test_chain_allows_cycle_guard():
    config = {"chainable": True}
    fields = {"chain_depth": 1, "chain_path": ["flow-1"]}
    assert not steps.chain_allows(config, fields, "flow-1")  # already on the path
    assert steps.chain_allows(config, fields, "flow-2")


def test_normalize_trigger_config_preserves_chainable():
    # mutation trigger: chainable survives, everything else is dropped
    out = _normalize_trigger_config("ticket_created", {"chainable": True, "junk": 1}, enabled=True)
    assert out == {"chainable": True}
    # falsy chainable is dropped, keeping the phase 1 {} shape
    assert _normalize_trigger_config("ticket_created", {"chainable": False}, enabled=True) == {}
    # schedule: chainable rides along with the validated schedule config
    out = _normalize_trigger_config(
        "schedule", {"frequency": "daily", "time": "08:30", "chainable": True}, enabled=True
    )
    assert out == {"frequency": "daily", "time": "08:30", "weekday": None, "chainable": True}


def test_flow_create_accepts_chainable_trigger_config():
    flow = FlowCreate(
        name="Chained",
        trigger_type="ticket_created",
        actions=[{"type": "notify_user", "config": {"user_id": "u", "message": "hi"}}],
        trigger_config={"chainable": True},
        enabled=False,
    )
    assert flow.trigger_config == {"chainable": True}


async def test_emit_flow_event_stamps_chain_inside_chain_scope():
    import uuid as _uuid

    from app.core.flow_events import chain_scope, emit_flow_event

    class _FakeDB:
        def __init__(self):
            self.added = []

        def add(self, obj):
            self.added.append(obj)

        async def flush(self):
            pass

    db = _FakeDB()
    tenant_id = _uuid.uuid4()
    with chain_scope({"depth": 2, "path": ["flow-1", "flow-2"]}):
        await emit_flow_event(
            db, tenant_id, "ticket_created",
            entity_type="ticket", payload={"subject": "chained"}, source="flow",
        )
    event = db.added[0]
    assert event.payload["subject"] == "chained"
    assert event.payload["chain_depth"] == 2
    assert event.payload["chain_path"] == ["flow-1", "flow-2"]

    # outside the scope nothing is stamped — app mutations stay chain-free
    await emit_flow_event(
        db, tenant_id, "ticket_created", entity_type="ticket", payload={"subject": "plain"},
    )
    assert "chain_depth" not in db.added[1].payload
    assert "chain_path" not in db.added[1].payload


# ------------------------------------------------------- [FLOW7] trigger registry

import re
from pathlib import Path

from app.config import ALL_MODULES
from app.modules.flows.schemas import FlowUpdate

# The full set the registry + the two flows-own triggers must cover.
_EXPECTED_TRIGGERS = [
    "ticket_created", "ticket_status_changed", "ticket_sla_due_soon",
    "contact_created", "pipeline_stage_changed", "draft_approved",
    "saas_health_dropped", "saas_signup", "conversation_started",
    "conversation_solved", "booking_created", "booking_cancelled",
    "campaign_button_clicked", "campaign_email_bounced", "contract_expiring",
    "invoice_overdue", "order_received", "schedule", "webhook",
]

_BACKEND_ROOT = Path(__file__).resolve().parent.parent / "app"


def test_registry_assembles_every_trigger():
    for key in _EXPECTED_TRIGGERS:
        assert key in TRIGGER_META, f"missing trigger {key}"
    # ticket_created must stay first — the picker + "New on canvas" default to it.
    assert next(iter(TRIGGER_META)) == "ticket_created"
    # every module gating value is either None or a real module id
    for key, meta in TRIGGER_META.items():
        module = meta["module"]
        assert module is None or module in ALL_MODULES, f"{key}: bad module {module}"


def test_registry_no_duplicate_keys_and_flows_own_are_module_none():
    assert TRIGGER_META["schedule"]["module"] is None
    assert TRIGGER_META["webhook"]["module"] is None


# First string literal after an emit_flow_event( open — the event_type in every
# callsite. re.S so multiline calls (kwargs on later lines) still match.
_EMIT_RE = re.compile(r"emit_flow_event\((?:[^\"')]|\n)*?[\"']([a-z_]+)[\"']", re.S)


def test_drift_guard_every_module_trigger_is_emitted_somewhere():
    emitted: set[str] = set()
    for path in _BACKEND_ROOT.rglob("*.py"):
        if "__pycache__" in path.parts:
            continue
        emitted.update(_EMIT_RE.findall(path.read_text(encoding="utf-8")))
    for key, meta in TRIGGER_META.items():
        if meta["module"] is None:
            continue  # schedule/webhook aren't emitted by a module mutation
        assert key in emitted, f"trigger {key} declared but never emitted"


def test_payload_discipline_condition_fields_subset_of_example_payload():
    for key, meta in TRIGGER_META.items():
        example = meta.get("example_payload")
        if example is None:
            continue
        field_keys = {f["key"] for f in meta["fields"]}
        assert field_keys <= set(example), (
            f"{key}: condition fields {field_keys - set(example)} missing from example_payload"
        )


def test_every_module_trigger_has_a_callable_fetch_fields():
    for key, meta in TRIGGER_META.items():
        if key in ("schedule", "webhook"):
            continue
        loader = meta.get("fetch_fields")
        assert callable(loader), f"{key}: fetch_fields must be callable"


def test_flow_update_rejects_unknown_trigger_and_accepts_known():
    import pytest as _pytest
    from pydantic import ValidationError

    with _pytest.raises(ValidationError):
        FlowUpdate(trigger_type="not_a_real_trigger")
    # a known one round-trips, and None (unset) stays allowed
    assert FlowUpdate(trigger_type="ticket_created").trigger_type == "ticket_created"
    assert FlowUpdate().trigger_type is None


# ------------------------------------------------ [FLOW8] builtins catalogue

from app.modules.flows.builtins import BUILTINS, builtins_for


def test_builtins_catalogue_is_well_formed():
    keys = [b["key"] for b in BUILTINS]
    assert len(keys) == len(set(keys)), "builtin keys must be unique"
    for b in BUILTINS:
        assert b["name"] and isinstance(b["name"], str)
        assert b["description"] and isinstance(b["description"], str)
        assert "module" in b
        assert b["module"] is None or b["module"] in ALL_MODULES, f"bad module {b['module']}"
        assert b["cadence"] and isinstance(b["cadence"], str)


def test_builtins_never_list_platform_internal_jobs():
    joined = " ".join(b["key"] for b in BUILTINS)
    for forbidden in ("demo", "trial", "retention", "onboarding", "engine"):
        assert forbidden not in joined, f"platform-internal '{forbidden}' leaked into builtins"


def test_builtins_for_filters_by_enabled_modules():
    # module None is always shown; module-scoped entries need the module enabled.
    always = [b["key"] for b in BUILTINS if b["module"] is None]
    result = builtins_for([])
    assert set(b["key"] for b in result) == set(always)
    # enabling a module reveals its entries
    inbox_entries = [b["key"] for b in BUILTINS if b["module"] == "inbox"]
    result_keys = {b["key"] for b in builtins_for(["inbox"])}
    assert set(inbox_entries) <= result_keys
    assert set(always) <= result_keys


# ------------------------------------------- [FLOW8] notify_user "assigned agent"

def test_notify_user_meta_has_recipient_with_both_options():
    fields = {f["key"]: f for f in ACTION_META["notify_user"]["config_fields"]}
    assert "recipient" in fields
    assert fields["recipient"]["options"] == ["specific user", "assigned agent"]


def test_action_config_whitelist_accepts_recipient():
    spec = ActionSpec(type="notify_user", config={
        "recipient": "assigned agent",
        "message": "Ticket {subject} due soon",
    })
    # recipient is auto-whitelisted from ACTION_META; user_id is optional here
    assert spec.config == {"recipient": "assigned agent", "message": "Ticket {subject} due soon"}


def test_flow_create_notify_assigned_agent_needs_no_user_id():
    flow = FlowCreate(
        name="SLA notify",
        trigger_type="ticket_sla_due_soon",
        actions=[{"type": "notify_user", "config": {
            "recipient": "assigned agent", "message": "due in {due_in_minutes}m",
        }}],
        enabled=False,
    )
    assert flow.actions[0].config == {
        "recipient": "assigned agent", "message": "due in {due_in_minutes}m",
    }


# ------------------------------------------- [FLOW8] default flow shapes validate

from app.modules.flows.service import DEFAULT_FLOWS


def test_default_flows_validate_through_flow_create():
    for spec in DEFAULT_FLOWS:
        flow = FlowCreate(
            name=spec["name"],
            trigger_type=spec["trigger_type"],
            conditions=[ConditionSpec(**c) for group in spec["conditions"] for c in group]
            if spec["conditions"] else [],
            actions=[ActionSpec(**a) for a in spec["actions"]],
            enabled=False,  # skip DB-backed enable-time validation
        )
        assert flow.trigger_type in TRIGGER_META
        for action in flow.actions:
            assert action.type in ACTION_EXECUTORS


def test_default_flows_are_the_two_sla_flows():
    names = {f["name"] for f in DEFAULT_FLOWS}
    assert names == {
        "Notify the assigned agent before SLA breach",
        "Escalate tickets before SLA breach",
    }
    for spec in DEFAULT_FLOWS:
        assert spec["trigger_type"] == "ticket_sla_due_soon"
