"""Dry-run ("test fire") helpers — pure and DB-free so they stay unit-testable.

A test fire synthesizes a *representative* sample event for a flow's trigger,
biased to satisfy the flow's own conditions (so the happy path is demonstrated),
evaluates the real conditions honestly against it, and then describes — WITHOUT
running anything — which actions would fire. The engine is never touched; no
outbox event is written and no executor runs.

The one non-pure input is the tenant's enabled modules: an action whose module
was since disabled reads as "would be skipped", mirroring the live engine.
"""
from __future__ import annotations

from typing import Any, Optional

from app.modules.flows.actions import ACTION_META, ACTION_MODULES, render_placeholders
from app.modules.flows.conditions import TRIGGER_META, _as_groups, evaluate_conditions

_SAMPLE_TEXT = "sample"


def _default_for_field(field_meta: dict) -> Any:
    """A plausible placeholder value for a trigger field with no matching
    condition — first option for a select, 1 for a number, a marker for text."""
    ftype = field_meta.get("type")
    if ftype in ("select",) and field_meta.get("options"):
        return field_meta["options"][0]
    if ftype == "number":
        return 1
    return _SAMPLE_TEXT


def _sample_for_condition(op: Optional[str], value: Any) -> Any:
    """A field value that SATISFIES a single condition, so the synthesized event
    exercises the flow's happy path. Returns None when we can't manufacture one
    (the field then keeps its trigger default and the condition may not match —
    which the honest evaluation will surface)."""
    if op in ("equals", "contains", "gte", "lte"):
        return value
    if op == "in":
        if isinstance(value, (list, tuple)) and value:
            return value[0]
        return value
    if op == "not_equals":
        # Anything different from the forbidden value satisfies not_equals.
        return f"not::{value}"
    return None


def build_sample_event(trigger_type: str, conditions: list) -> dict:
    """Synthesize the event `fields` a test fire runs against: trigger-field
    defaults overlaid with values derived from the flow's conditions."""
    meta = TRIGGER_META.get(trigger_type, {})
    fields: dict = {f["key"]: _default_for_field(f) for f in meta.get("fields", [])}
    for group in _as_groups(conditions or []):
        for condition in group:
            field = condition.get("field")
            if not field:
                continue
            sample = _sample_for_condition(condition.get("op"), condition.get("value"))
            if sample is not None:
                fields[field] = sample
    fields["event_type"] = trigger_type
    return fields


def _action_detail(action_type: str, config: dict, fields: dict) -> str:
    """A one-line human description of what an action would do, with event
    placeholders rendered against the sample event."""
    def rendered(key: str) -> str:
        return render_placeholders(config.get(key) or "", fields).strip()

    if action_type == "wait":
        for unit in ("days", "hours", "minutes"):
            if unit in config:
                amount = config[unit]
                label = unit[:-1] if str(amount) == "1" else unit
                return f"Pause the flow for {amount} {label}"
        return "Pause the flow"
    if action_type == "create_ticket":
        subject = rendered("subject")
        return f"Create a ticket “{subject}”" if subject else "Create a ticket"
    if action_type == "update_ticket":
        bits = [f"{k} → {config[k]}" for k in ("status", "priority") if config.get(k)]
        if config.get("assigned_to"):
            bits.append("reassign")
        return "Update the ticket" + (f" ({', '.join(bits)})" if bits else "")
    if action_type == "move_pipeline_stage":
        return "Move the contact to the selected pipeline stage"
    if action_type == "notify_user":
        message = rendered("message")
        return f"Notify a team member: “{message}”" if message else "Notify a team member"
    if action_type == "send_email":
        subject = rendered("subject")
        return f"Email the contact “{subject}”" if subject else "Email the contact"
    return ACTION_META.get(action_type, {}).get("label", action_type)


def preview_actions(
    actions: list, fields: dict, matched: bool, enabled_modules: list[str]
) -> list[dict]:
    """Describe each action and whether it would actually run. Nothing runs if
    the conditions didn't match; an action whose module is disabled is skipped
    exactly as the live engine would skip it."""
    previews = []
    for action in actions or []:
        action_type = action.get("type")
        config = action.get("config") or {}
        module = ACTION_MODULES.get(action_type)
        if not matched:
            would_run, reason = False, "conditions did not match the sample event"
        elif module and module not in (enabled_modules or []):
            would_run, reason = False, f"the '{module}' module is disabled"
        else:
            would_run, reason = True, None
        previews.append({
            "type": action_type,
            "label": ACTION_META.get(action_type, {}).get("label", action_type),
            "detail": _action_detail(action_type, config, fields),
            "would_run": would_run,
            "reason": reason,
        })
    return previews


def dry_run(
    trigger_type: str, conditions: list, actions: list, enabled_modules: list[str]
) -> dict:
    """The full test-fire result: the synthesized sample event, whether the
    conditions matched it, and the per-action preview. Executes nothing."""
    fields = build_sample_event(trigger_type, conditions)
    matched = evaluate_conditions(conditions or [], fields)
    sample_event = {k: v for k, v in fields.items() if k != "event_type"}
    return {
        "trigger_type": trigger_type,
        "sample_event": sample_event,
        "matched": matched,
        "actions": preview_actions(actions, fields, matched, enabled_modules),
    }
