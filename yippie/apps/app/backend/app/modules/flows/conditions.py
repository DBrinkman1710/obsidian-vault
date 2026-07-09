"""Condition evaluation + the trigger catalogue served to the builder UI.

A condition is {"field", "op", "value"}. Conditions are grouped as OR-of-AND:
the stored shape is a list of groups [[A, B], [C]] meaning (A AND B) OR C. A
legacy flat list [A, B] is treated as a single AND group (backward compatible,
no data migration). Missing fields never match (also for not_equals — a flow
should only fire on data it can actually see).
"""
from __future__ import annotations

from typing import Any

from app.modules.flows import trigger_registry

CONDITION_OPS = ("equals", "not_equals", "contains", "in", "gte", "lte")

# [FLOW7] Trigger catalogue: label + condition fields for the builder, the module
# whose code emits the event (a flow on that trigger is pointless without it), and
# — for most triggers — a fetch_fields loader ([FLOW4] fresh-state) + an
# example_payload (the drift guard test's contract). Per-module declarations live
# in each module's flow_triggers.py and are merged here by trigger_registry. Only
# the two flows-owned triggers (schedule + webhook, module None) are declared
# locally: neither is emitted by a module mutation. Every consumer keeps importing
# TRIGGER_META from here — same name, same shape.
TRIGGER_META: dict[str, dict] = trigger_registry.assemble_trigger_meta()
TRIGGER_META.update({
    "schedule": {
        "label": "On a schedule",
        "module": None,  # time trigger — fires from the scheduler, not a mutation
        "fields": [
            {"key": "weekday", "label": "Weekday (0=Mon…6=Sun)", "type": "select",
             "options": ["0", "1", "2", "3", "4", "5", "6"]},
        ],
    },
    "webhook": {
        "label": "Webhook received",
        "module": None,  # inbound — fires from a tokened public URL, not a mutation
        # The payload's keys aren't known until data arrives, so the builder lets
        # you type a field name freely rather than pick from a fixed list.
        "free_fields": True,
        "fields": [],
    },
})


def _norm(value: Any) -> Any:
    if isinstance(value, str):
        return value.strip().lower()
    return value


def _as_number(value: Any) -> float:
    if isinstance(value, bool):
        raise ValueError("bool is not a number")
    return float(value)


def evaluate_condition(condition: dict, fields: dict) -> bool:
    field = condition.get("field")
    op = condition.get("op")
    expected = condition.get("value")
    actual = fields.get(field)
    if actual is None or op not in CONDITION_OPS:
        return False

    if op == "equals":
        return _norm(actual) == _norm(expected)
    if op == "not_equals":
        return _norm(actual) != _norm(expected)
    if op == "contains":
        if isinstance(actual, (list, tuple)):
            return _norm(expected) in [_norm(v) for v in actual]
        return isinstance(actual, str) and str(_norm(expected)) in actual.strip().lower()
    if op == "in":
        if not isinstance(expected, (list, tuple)):
            return False
        return _norm(actual) in [_norm(v) for v in expected]
    if op in ("gte", "lte"):
        try:
            a, b = _as_number(actual), _as_number(expected)
        except (TypeError, ValueError):
            return False
        return a >= b if op == "gte" else a <= b
    return False


def _as_groups(conditions: list) -> list[list[dict]]:
    """Normalize a condition list into OR-of-AND groups. A legacy flat list of
    conditions [{...}, {...}] becomes a single group [[{...}, {...}]]; an already
    grouped list is returned unchanged; empty input → no groups."""
    if not conditions:
        return []
    if isinstance(conditions[0], list):
        return conditions
    return [conditions]


def evaluate_conditions(conditions: list, fields: dict) -> bool:
    """OR across groups, AND within each group. A flat list is one AND group
    (backward compatible). No conditions at all → always matches."""
    groups = _as_groups(conditions)
    if not groups:
        return True
    return any(
        all(evaluate_condition(c, fields) for c in group)
        for group in groups
    )
