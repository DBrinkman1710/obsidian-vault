"""Flow engine — drains the flow_events outbox and executes matching flows.

Every ~10s: claim a batch of unprocessed events (marked processed up front so a
crash mid-batch can never double-run actions), then per event evaluate that
tenant's enabled flows and execute their actions. Each action runs in its own
tenant-scoped session (RLS enforced via app_user, same as a request) and every
matched flow gets a flow_runs audit row — including skipped condition misses so
tenants can self-serve "why didn't my flow fire".

Loop protection (phase 1): events with source='flow' are claimed but never
evaluated, so flow actions cannot trigger further flows.

Start it from the main.py lifespan alongside the other schedulers.
"""
from __future__ import annotations

import logging
import uuid
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Tenant
from app.core.scheduler_lock import skip_if_locked
from app.database import db_session, set_tenant_context
from app.modules.flows.actions import ACTION_EXECUTORS, ACTION_MODULES
from app.modules.flows.conditions import evaluate_conditions
from app.modules.flows.models import Flow, FlowEvent, FlowRun

log = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()

BATCH_SIZE = 200


async def _claim_events(db: AsyncSession) -> list[dict]:
    """Mark a batch processed and return snapshots. Claim-first means a crash
    loses at most one batch — it never replays actions (no-retry, phase 1)."""
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


async def _record_run(
    tenant_id: uuid.UUID, flow_id: uuid.UUID, event: dict,
    run_status: str, results: list[dict], error: Optional[str],
) -> None:
    async with db_session() as db:
        await db.execute(text("SET LOCAL row_security = off"))
        db.add(FlowRun(
            tenant_id=tenant_id,
            flow_id=flow_id,
            event={k: v for k, v in event.items() if k != "id"},
            status=run_status,
            results=results,
            error=error,
        ))
        if run_status != "skipped":
            await db.execute(
                update(Flow)
                .where(Flow.id == flow_id, Flow.tenant_id == tenant_id)
                .values(run_count=Flow.run_count + 1, last_run_at=func.now())
            )
        await db.commit()


async def _process_event(event: dict) -> None:
    tenant, flows = await _load_flows(event["tenant_id"], event["event_type"])
    if tenant is None:
        return
    for flow in flows:
        if not evaluate_conditions(flow["conditions"], event["fields"]):
            await _record_run(tenant.id, flow["id"], event, "skipped", [], None)
            continue
        results: list[dict] = []
        error: Optional[str] = None
        for action in flow["actions"]:
            try:
                results.append(await _run_action(tenant, event, action))
            except Exception as exc:  # keep executing the remaining actions
                log.exception("flow %s action %s failed", flow["id"], action.get("type"))
                error = str(exc)[:2000]
                results.append({"type": action.get("type"), "ok": False, "skipped": False,
                                "summary": f"Failed: {exc}"})
        ok_count = sum(1 for r in results if r.get("ok"))
        if ok_count == len(results):
            run_status = "success"
        elif ok_count > 0:
            run_status = "partial"
        else:
            run_status = "failed"
        await _record_run(tenant.id, flow["id"], event, run_status, results, error)


@scheduler.scheduled_job("interval", seconds=10, id="flow_engine", max_instances=1, coalesce=True)
async def flow_engine_tick():
    if await skip_if_locked("flow_engine", ttl=9):
        return
    try:
        async with db_session() as db:
            events = await _claim_events(db)
    except Exception:
        log.exception("flow engine: claiming events failed")
        return
    for event in events:
        if event["source"] == "flow":
            continue  # loop protection: flow output never triggers flows
        try:
            await _process_event(event)
        except Exception:
            log.exception("flow engine: processing event %s failed", event["id"])


def start_scheduler():
    if not scheduler.running:
        scheduler.start()
        log.info("Flow engine scheduler started")
