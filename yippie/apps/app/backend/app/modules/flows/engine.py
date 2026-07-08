"""Flow engine — drains the flow_events outbox and executes matching flows.

Every ~10s: claim a batch of unprocessed events (marked processed up front so a
crash mid-batch can never double-run actions), then per event evaluate that
tenant's enabled flows and execute their actions. Each action runs in its own
tenant-scoped session (RLS enforced via app_user, same as a request) and every
matched flow gets a flow_runs audit row — including skipped condition misses so
tenants can self-serve "why didn't my flow fire".

Phase 2 makes flows time-aware. Two step kinds pause a run and resume later,
both persisted in flow_pending_steps and drained on the same 10s tick:
  - wait  — a delay step; the remaining actions resume once resume_at passes.
  - retry — a raised action; it re-runs after a backoff (steps.retry_delay),
            up to steps.MAX_ATTEMPTS, before the failure is recorded and the
            rest of the flow continues (phase 1 "keep going" semantics).
Frozen results (already-run actions) are stored on the pending step and never
re-run — claim-first deletion means a crash loses at most one resume.

Loop protection (phase 1): events with source='flow' are claimed but never
evaluated, so flow actions cannot trigger further flows.

Start it from the main.py lifespan alongside the other schedulers.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import delete, exists, func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.flow_events import emit_flow_event
from app.core.models import Tenant
from app.core.scheduler_lock import skip_if_locked
from app.database import db_session, set_tenant_context
from app.modules.flows import steps
from app.modules.flows.actions import ACTION_EXECUTORS, ACTION_MODULES
from app.modules.flows.conditions import evaluate_conditions
from app.modules.flows.models import Flow, FlowEvent, FlowPendingStep, FlowRun

log = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()

BATCH_SIZE = 200
PENDING_BATCH_SIZE = 100

# A run can't legitimately wait longer than the max total wait; give it a day of
# slack before the sweeper treats a still-"waiting" run with no pending step as
# orphaned (a crash between claiming a pending step and finishing the resume).
STALE_WAITING_SLACK = timedelta(days=1)


async def _claim_events(db: AsyncSession) -> list[dict]:
    """Mark a batch processed and return snapshots. Claim-first means a crash
    loses at most one batch — it never replays actions."""
    await db.execute(text("SET LOCAL row_security = off"))
    result = await db.execute(
        update(FlowEvent)
        .where(FlowEvent.id.in_(
            select(FlowEvent.id)
            .where(FlowEvent.processed_at.is_(None))
            .order_by(FlowEvent.created_at)
            .limit(BATCH_SIZE)
        ))
        .values(processed_at=func.now())
        .returning(
            FlowEvent.id, FlowEvent.tenant_id, FlowEvent.event_type,
            FlowEvent.entity_type, FlowEvent.entity_id, FlowEvent.contact_id,
            FlowEvent.actor_id, FlowEvent.payload, FlowEvent.source,
        )
    )
    rows = result.all()
    await db.commit()
    return [
        {
            "id": row.id,
            "tenant_id": row.tenant_id,
            "event_type": row.event_type,
            "entity_type": row.entity_type,
            "entity_id": str(row.entity_id) if row.entity_id else None,
            "contact_id": str(row.contact_id) if row.contact_id else None,
            "actor_id": str(row.actor_id) if row.actor_id else None,
            "source": row.source,
            "fields": {
                **(row.payload or {}),
                "event_type": row.event_type,
                "contact_id": str(row.contact_id) if row.contact_id else None,
            },
        }
        for row in rows
    ]


async def _load_flows(tenant_id: uuid.UUID, trigger_type: str) -> tuple[Optional[Tenant], list[dict]]:
    async with db_session() as db:
        await db.execute(text("SET LOCAL row_security = off"))
        tenant = await db.get(Tenant, tenant_id)
        if tenant is None or "flows" not in (tenant.enabled_modules or []):
            return None, []
        result = await db.execute(
            select(Flow).where(
                Flow.tenant_id == tenant_id,
                Flow.trigger_type == trigger_type,
                Flow.enabled.is_(True),
            )
        )
        flows = [
            {"id": f.id, "name": f.name, "conditions": f.conditions or [], "actions": f.actions or []}
            for f in result.scalars().all()
        ]
        return tenant, flows


async def _run_action(tenant: Tenant, event: dict, action: dict) -> dict:
    action_type = action.get("type")
    executor = ACTION_EXECUTORS.get(action_type)
    if executor is None:
        return {"type": action_type, "ok": False, "skipped": True,
                "summary": f"Unknown action '{action_type}'"}
    required_module = ACTION_MODULES.get(action_type)
    if required_module and required_module not in (tenant.enabled_modules or []):
        return {"type": action_type, "ok": False, "skipped": True,
                "summary": f"Module '{required_module}' is disabled"}
    # Fresh session per action: services commit internally, and SET LOCAL
    # tenant context does not survive a commit — same lifecycle as a request.
    async with db_session() as db:
        await set_tenant_context(db, str(tenant.id))
        result = await executor(db, tenant, event, action.get("config") or {})
    return {"type": action_type, **result}


def _event_snapshot(event: dict) -> dict:
    """The event as persisted on a run / pending step (drop the transient outbox id)."""
    return {k: v for k, v in event.items() if k != "id"}


async def _upsert_run(
    tenant_id: uuid.UUID, flow_id: uuid.UUID, event: dict,
    run_status: str, results: list[dict], error: Optional[str],
    run_id: Optional[uuid.UUID],
) -> uuid.UUID:
    """Insert a fresh run (bumping run_count/last_run_at unless it's a skipped
    condition miss) or update an existing paused run to its next status. The
    counter bump happens exactly once — at the first non-skipped insert — so a
    run that pauses and resumes still counts as a single run."""
    async with db_session() as db:
        await db.execute(text("SET LOCAL row_security = off"))
        if run_id is None:
            run = FlowRun(
                tenant_id=tenant_id, flow_id=flow_id, event=_event_snapshot(event),
                status=run_status, results=results, error=error,
            )
            db.add(run)
            await db.flush()
            run_id = run.id
            if run_status != "skipped":
                await db.execute(
                    update(Flow)
                    .where(Flow.id == flow_id, Flow.tenant_id == tenant_id)
                    .values(run_count=Flow.run_count + 1, last_run_at=func.now())
                )
        else:
            await db.execute(
                update(FlowRun)
                .where(FlowRun.id == run_id, FlowRun.tenant_id == tenant_id)
                .values(status=run_status, results=results, error=error)
            )
        await db.commit()
    return run_id


async def _persist_pending(
    tenant_id: uuid.UUID, flow_id: uuid.UUID, run_id: uuid.UUID, event: dict,
    remaining: list[dict], results: list[dict], kind: str,
    resume_at: datetime, attempt: int,
) -> None:
    async with db_session() as db:
        await db.execute(text("SET LOCAL row_security = off"))
        db.add(FlowPendingStep(
            tenant_id=tenant_id, flow_id=flow_id, run_id=run_id, kind=kind,
            event=_event_snapshot(event), actions=remaining, results=results,
            attempt=attempt, resume_at=resume_at,
        ))
        await db.commit()


def _wait_summary(config: dict) -> str:
    for unit in ("days", "hours", "minutes"):
        if unit in config:
            amount = config[unit]
            label = unit[:-1] if amount == 1 else unit
            return f"Waited {amount} {label}"
    return "Waited"


def _derive_error(results: list[dict]) -> Optional[str]:
    """The most recent hard failure's summary — surfaced on the run row."""
    for result in reversed(results):
        if not result.get("ok") and not result.get("skipped"):
            return result.get("summary")
    return None


async def _execute_flow(
    tenant: Tenant, event: dict, flow_id: uuid.UUID, actions: list[dict],
    results: list[dict], run_id: Optional[uuid.UUID], attempt: int,
) -> None:
    """Walk the remaining actions. Pauses (persisting a pending step and
    returning) on a wait or on a retryable failure; otherwise finalises the run.

    `attempt` is the number of failures already recorded for actions[0] — only
    the resumed head of a retry carries a non-zero value.
    """
    now = datetime.now(timezone.utc)
    for idx, action in enumerate(actions):
        action_type = action.get("type")
        prior_attempts = attempt if idx == 0 else 0

        if action_type == "wait":
            config = action.get("config") or {}
            delta = steps.wait_delta(config)
            results.append({"type": "wait", "ok": True, "skipped": False,
                            "summary": _wait_summary(config), "attempts": 1})
            run_id = await _upsert_run(tenant.id, flow_id, event, "waiting", results, None, run_id)
            await _persist_pending(
                tenant.id, flow_id, run_id, event, actions[idx + 1:], results,
                kind="wait", resume_at=now + delta, attempt=0,
            )
            return

        try:
            result = await _run_action(tenant, event, action)
        except Exception as exc:  # noqa: BLE001 — recorded, not raised
            made = prior_attempts + 1
            delay = steps.retry_delay(made)
            if delay is not None:
                # Show a transient pending-retry row on the run, but freeze the
                # step's results WITHOUT it (the real result is appended on resume).
                run_results = results + [{
                    "type": action_type, "ok": False, "skipped": False,
                    "summary": f"Retry {made} scheduled: {exc}"[:2000],
                    "attempts": made, "pending_retry": True,
                }]
                run_id = await _upsert_run(tenant.id, flow_id, event, "waiting", run_results, None, run_id)
                await _persist_pending(
                    tenant.id, flow_id, run_id, event, actions[idx:], results,
                    kind="retry", resume_at=now + delay, attempt=made,
                )
                return
            log.exception("flow %s action %s failed after retries", flow_id, action_type)
            results.append({"type": action_type, "ok": False, "skipped": False,
                            "summary": f"Failed after {made} attempts: {exc}"[:2000],
                            "attempts": made})
            continue  # phase 1 semantics: keep running the remaining actions

        result["attempts"] = prior_attempts + 1
        results.append(result)

    await _upsert_run(
        tenant.id, flow_id, event, steps.derive_run_status(results),
        results, _derive_error(results), run_id,
    )


async def _process_event(event: dict) -> None:
    tenant, flows = await _load_flows(event["tenant_id"], event["event_type"])
    if tenant is None:
        return
    # A schedule event is addressed to a single flow (payload carries its id) so
    # sibling schedule flows don't each record a skipped run for it.
    target_flow_id = event["fields"].get("flow_id") if event["event_type"] == "schedule" else None
    for flow in flows:
        if target_flow_id is not None and str(flow["id"]) != str(target_flow_id):
            continue
        if not evaluate_conditions(flow["conditions"], event["fields"]):
            await _upsert_run(tenant.id, flow["id"], event, "skipped", [], None, None)
            continue
        await _execute_flow(tenant, event, flow["id"], flow["actions"], [], None, 0)


async def _claim_pending(db: AsyncSession) -> list[dict]:
    """Claim due pending steps (delete-and-return, same crash philosophy as
    _claim_events) so a resumed step can never run twice."""
    await db.execute(text("SET LOCAL row_security = off"))
    result = await db.execute(
        delete(FlowPendingStep)
        .where(FlowPendingStep.id.in_(
            select(FlowPendingStep.id)
            .where(FlowPendingStep.resume_at <= func.now())
            .order_by(FlowPendingStep.resume_at)
            .limit(PENDING_BATCH_SIZE)
        ))
        .returning(
            FlowPendingStep.id, FlowPendingStep.tenant_id, FlowPendingStep.flow_id,
            FlowPendingStep.run_id, FlowPendingStep.event, FlowPendingStep.actions,
            FlowPendingStep.results, FlowPendingStep.attempt,
        )
    )
    rows = result.all()
    await db.commit()
    return [
        {
            "id": row.id,
            "tenant_id": row.tenant_id,
            "flow_id": row.flow_id,
            "run_id": row.run_id,
            "event": row.event or {},
            "actions": row.actions or [],
            "results": row.results or [],
            "attempt": row.attempt or 0,
        }
        for row in rows
    ]


async def _load_tenant_if_flow_live(tenant_id: uuid.UUID, flow_id: uuid.UUID) -> Optional[Tenant]:
    """Re-check the tenant/module/flow before resuming — anything torn down
    while the step waited means the tail is abandoned (returns None)."""
    async with db_session() as db:
        await db.execute(text("SET LOCAL row_security = off"))
        tenant = await db.get(Tenant, tenant_id)
        if tenant is None or "flows" not in (tenant.enabled_modules or []):
            return None
        flow = await db.get(Flow, flow_id)
        if flow is None or not flow.enabled or flow.tenant_id != tenant_id:
            return None
        return tenant


async def _abandon_run(tenant_id: uuid.UUID, run_id: uuid.UUID, results: list[dict]) -> None:
    """Close a paused run whose flow was disabled/deleted mid-wait. The flow_runs
    row may itself have cascaded away, so the update is guarded (no-op if gone)."""
    status = steps.derive_run_status(results) if results else "skipped"
    async with db_session() as db:
        await db.execute(text("SET LOCAL row_security = off"))
        await db.execute(
            update(FlowRun)
            .where(FlowRun.id == run_id, FlowRun.tenant_id == tenant_id)
            .values(status=status, error=_derive_error(results))
        )
        await db.commit()


async def _resume_step(step: dict) -> None:
    tenant = await _load_tenant_if_flow_live(step["tenant_id"], step["flow_id"])
    if tenant is None:
        await _abandon_run(step["tenant_id"], step["run_id"], step["results"])
        return
    await _execute_flow(
        tenant, step["event"], step["flow_id"], step["actions"],
        step["results"], step["run_id"], step["attempt"],
    )


@scheduler.scheduled_job("interval", seconds=10, id="flow_engine", max_instances=1, coalesce=True)
async def flow_engine_tick():
    if await skip_if_locked("flow_engine", ttl=9):
        return

    try:
        async with db_session() as db:
            events = await _claim_events(db)
    except Exception:
        log.exception("flow engine: claiming events failed")
        events = []
    for event in events:
        if event["source"] == "flow":
            continue  # loop protection: flow output never triggers flows
        try:
            await _process_event(event)
        except Exception:
            log.exception("flow engine: processing event %s failed", event["id"])

    # Resume waits + retries that have come due (folded into the same tick/lock).
    try:
        async with db_session() as db:
            pending = await _claim_pending(db)
    except Exception:
        log.exception("flow engine: claiming pending steps failed")
        pending = []
    for step in pending:
        try:
            await _resume_step(step)
        except Exception:
            log.exception("flow engine: resuming step %s failed", step["id"])


@scheduler.scheduled_job("interval", minutes=1, id="flow_schedule", max_instances=1, coalesce=True)
async def flow_schedule_tick():
    """Fire `schedule`-trigger flows at their configured local time. Each due flow
    emits one `schedule` outbox event (payload carries its own id so the engine
    fires only the addressed flow) and stamps `last_scheduled_on` in the SAME
    transaction — the outbox guarantee — so a missed minute self-heals the same
    local day and a flow never fires twice in a day."""
    if await skip_if_locked("flow_schedule", ttl=55):
        return
    from app.modules.booking.models import CalendarSettings

    try:
        async with db_session() as db:
            await db.execute(text("SET LOCAL row_security = off"))
            tenants = {t.id: t for t in (await db.execute(select(Tenant))).scalars().all()}
            tz_by_tenant = dict(
                (await db.execute(
                    select(CalendarSettings.tenant_id, CalendarSettings.timezone)
                )).all()
            )
            flows = (await db.execute(
                select(Flow).where(Flow.trigger_type == "schedule", Flow.enabled.is_(True))
            )).scalars().all()

            emitted = 0
            for flow in flows:
                tenant = tenants.get(flow.tenant_id)
                if tenant is None or "flows" not in (tenant.enabled_modules or []):
                    continue
                try:
                    tz = ZoneInfo(tz_by_tenant.get(tenant.id) or "Europe/Amsterdam")
                except Exception:
                    tz = ZoneInfo("Europe/Amsterdam")
                local_now = datetime.now(tz)
                if not steps.schedule_is_due(flow.trigger_config or {}, local_now, flow.last_scheduled_on):
                    continue
                today_str = local_now.date().isoformat()
                await emit_flow_event(
                    db, tenant.id, "schedule",
                    entity_type="schedule",
                    payload={
                        "flow_id": str(flow.id),
                        "date": today_str,
                        "weekday": str(local_now.weekday()),
                        "time": (flow.trigger_config or {}).get("time"),
                    },
                )
                flow.last_scheduled_on = today_str
                emitted += 1
            if emitted:
                await db.commit()
                log.info("flow schedule tick: emitted %d scheduled event(s)", emitted)
    except Exception:
        log.exception("flow engine: schedule tick failed")


@scheduler.scheduled_job("interval", hours=1, id="flow_waiting_sweeper", max_instances=1, coalesce=True)
async def flow_waiting_sweeper_tick():
    """Close orphaned `waiting` runs. Claim-first resume ([FLOW2A]) means a crash
    between claiming a pending step and finishing its resume can leave a run row
    stuck at `waiting` with no pending step behind it. A run can legitimately wait
    at most the max total wait, so any `waiting` run older than that (plus a day of
    slack) with no matching flow_pending_steps row is dead — mark it failed."""
    if await skip_if_locked("flow_waiting_sweeper", ttl=3300):
        return
    cutoff = datetime.now(timezone.utc) - (steps.MAX_WAIT + STALE_WAITING_SLACK)
    has_pending = exists().where(FlowPendingStep.run_id == FlowRun.id)
    try:
        async with db_session() as db:
            await db.execute(text("SET LOCAL row_security = off"))
            result = await db.execute(
                update(FlowRun)
                .where(
                    FlowRun.status == "waiting",
                    FlowRun.created_at < cutoff,
                    ~has_pending,
                )
                .values(
                    status="failed",
                    error="Swept: waiting run had no pending step (engine likely crashed mid-resume)",
                )
            )
            await db.commit()
            if result.rowcount:
                log.info("flow waiting sweeper: closed %d stale waiting run(s)", result.rowcount)
    except Exception:
        log.exception("flow engine: waiting sweeper failed")


def start_scheduler():
    if not scheduler.running:
        scheduler.start()
        log.info("Flow engine scheduler started")
