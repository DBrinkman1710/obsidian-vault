"""Flows module unit tests — condition evaluator + recipe/schema invariants.

DB-free (same pattern as test_smoke.py): everything here is pure logic.
"""
import pytest

from app.modules.flows.actions import ACTION_EXECUTORS, ACTION_META, ACTION_MODULES, render_placeholders
from app.modules.flows.conditions import TRIGGER_META, evaluate_condition, evaluate_conditions
from app.modules.flows.recipes import RECIPES, RECIPES_BY_KEY
from app.modules.flows.schemas import ActionSpec, ConditionSpec, FlowCreate


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
    assert set(ACTION_EXECUTORS) == set(ACTION_META) == set(ACTION_MODULES)


def test_every_trigger_has_label_module_and_fields():
    for key, meta in TRIGGER_META.items():
        assert meta["label"]
        assert "module" in meta
        assert isinstance(meta["fields"], list) and meta["fields"]


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
