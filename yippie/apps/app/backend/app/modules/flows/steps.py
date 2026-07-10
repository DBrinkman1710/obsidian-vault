"""Pure step arithmetic for the flow engine — DB-free so it stays unit-testable.

Holds everything the engine needs to reason about *time* and *outcome* without a
session: how long a wait lasts, whether a flow's waits are legal, the retry
backoff ladder, the run-status matrix, and whether a scheduled flow is due. The
engine (engine.py) owns the sessions and side effects; this module owns the math.
"""
from __future__ import annotations

from datetime import datetime, timedelta

# A single wait may not exceed 30 days, and neither may a flow's total wait.
MAX_WAIT = timedelta(days=30)
WAIT_UNITS = ("minutes", "hours", "days")

# Retry backoff for a raised action: 1st retry after 60s, 2nd after 300s, then
# give up. MAX_ATTEMPTS = 1 initial + len(ladder) retries = 3.
RETRY_LADDER = (timedelta(seconds=60), timedelta(seconds=300))
MAX_ATTEMPTS = 1 + len(RETRY_LADDER)

# [FLOW6] A chain of flows triggering flows ends after this many links: an event
# at depth MAX_CHAIN_DEPTH is claimed but fires nothing.
MAX_CHAIN_DEPTH = 3


def wait_delta(config: dict) -> timedelta:
    """The duration of one wait step. Exactly one of minutes/hours/days, a
    positive whole number, capped at 30 days. Raises ValueError otherwise."""
    config = config or {}
    present = [u for u in WAIT_UNITS if u in config]
    if len(present) != 1:
        raise ValueError("A wait needs exactly one of minutes, hours or days")
    unit = present[0]
    raw = config[unit]
    if isinstance(raw, bool):
        raise ValueError("A wait amount must be a positive whole number")
    try:
        amount = int(raw)
    except (TypeError, ValueError):
        raise ValueError("A wait amount must be a positive whole number")
    if amount <= 0:
        raise ValueError("A wait amount must be a positive whole number")
    delta = timedelta(**{unit: amount})
    if delta > MAX_WAIT:
        raise ValueError("A single wait may not exceed 30 days")
    return delta


def total_wait_days(actions) -> float:
    """The wait total counted against the 30-day cap. [FLOW4] made this graph
    aware: waits are summed along the longest path (a linear list IS its own
    longest path, so phase 2 behaviour is unchanged). Deferred import — graph.py
    imports this module for wait_delta."""
    from app.modules.flows import graph

    return graph.total_wait_days(actions)


def validate_wait_placement(actions) -> None:
    """A flow may not end on a wait (nothing left to do afterwards) and its total
    wait may not exceed 30 days — on any path, for [FLOW4] graphs. Raises
    ValueError (each wait_delta also validates its own config)."""
    from app.modules.flows import graph

    graph.validate_wait_placement(actions)


def derive_run_status(results: list[dict]) -> str:
    """Map a run's action results to success | partial | failed. Soft skips
    (module disabled, no contact on the event) read as partial, never failed —
    failed is reserved for real errors. Moved verbatim from the phase 1 engine."""
    ok_count = sum(1 for r in results if r.get("ok"))
    hard_failures = sum(1 for r in results if not r.get("ok") and not r.get("skipped"))
    if results and ok_count == len(results):
        return "success"
    if ok_count == 0 and hard_failures == len(results):
        return "failed"
    return "partial"


def retry_delay(attempt: int) -> timedelta | None:
    """Backoff before the next retry, given how many attempts have already been
    made. attempt 1 → 60s, 2 → 300s, else None (give up)."""
    if 1 <= attempt <= len(RETRY_LADDER):
        return RETRY_LADDER[attempt - 1]
    return None


def chain_of(fields: dict) -> tuple[int, list[str]]:
    """[FLOW6] The chain a flow-caused event sits on, read from its payload
    fields: (depth, path of flow ids walked so far). Absent/garbled values read
    as a fresh chain — payloads round-trip through JSONB. Chain fields on a
    non-flow event (an inbound webhook body could carry them) are stripped by the
    engine before this runs, so only genuine engine-stamped chains are honoured."""
    fields = fields or {}
    try:
        depth = int(fields.get("chain_depth") or 0)
    except (TypeError, ValueError):
        depth = 0
    raw_path = fields.get("chain_path")
    path = [str(p) for p in raw_path] if isinstance(raw_path, (list, tuple)) else []
    return depth, path


def next_chain(fields: dict, flow_id) -> dict:
    """The chain identity stamped onto events caused by `flow_id`'s actions:
    one link deeper, with this flow appended to the path."""
    depth, path = chain_of(fields)
    return {"depth": depth + 1, "path": path + [str(flow_id)]}


def chain_allows(trigger_config: dict | None, fields: dict, flow_id) -> bool:
    """May this flow fire on a flow-caused event? Three gates: the flow opted in
    (trigger_config {"chainable": true} — phase 1 behaviour is the default), the
    chain hasn't hit the depth cap, and this flow isn't already on the chain
    path (cycle guard)."""
    if not (trigger_config or {}).get("chainable"):
        return False
    depth, path = chain_of(fields)
    if depth >= MAX_CHAIN_DEPTH:
        return False
    return str(flow_id) not in path


def schedule_is_due(config: dict, local_now: datetime, last_scheduled_on: str | None) -> bool:
    """Whether a schedule-trigger flow should fire, evaluated in the tenant's
    local time. Fires once per local day at/after the configured HH:MM (missed
    ticks self-heal the same day); weekly only fires on the configured weekday.
    `last_scheduled_on` is the 'YYYY-MM-DD' the flow last fired on."""
    config = config or {}
    frequency = config.get("frequency")
    time_str = config.get("time")
    if frequency not in ("daily", "weekly") or not time_str:
        return False
    if last_scheduled_on == local_now.date().isoformat():
        return False  # already fired today
    if frequency == "weekly":
        weekday = config.get("weekday")
        if weekday is None or local_now.weekday() != int(weekday):
            return False
    try:
        hour, minute = (int(p) for p in str(time_str).split(":"))
    except (ValueError, TypeError):
        return False
    return (local_now.hour, local_now.minute) >= (hour, minute)
