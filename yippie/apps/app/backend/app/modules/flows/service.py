from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core._modules_gen import MODULE_META
from app.core.models import Tenant, User
from app.core.plans import limits_for_plan
from app.modules.flows import graph, preview, steps
from app.modules.flows.actions import ACTION_META, ACTION_MODULES
from app.modules.flows.conditions import TRIGGER_META
from app.modules.flows.models import Flow, FlowRun
from app.modules.flows.recipes import RECIPES, RECIPES_BY_KEY
from app.modules.flows.schemas import (
    FlowCreate, FlowUpdate, ScheduleConfigSpec, dump_actions,
)

# Run statuses that count toward the "fail" tally on a list row. A partial run
# (some actions failed) is a health signal too, so it sits on the fail side;
# waiting/skipped are neither a success nor a failure and are not counted.
_FAIL_STATUSES = ("failed", "partial")


def stepwise_sla_escalation_graph() -> dict:
    """[SLA restore] The default SLA escalation flow's actions as a branched graph
    that recreates the retired stepwise post-breach escalation job (which climbed
    a ticket's priority one notch per tick, low→…→urgent, only while it stayed
    open/in_progress) using flow steps.

    Fired by ``ticket_sla_due_soon`` (~60 min before breach — the only SLA trigger
    the engine has), it escalates in STEPS rather than the one-shot jump to urgent
    the FLOW8 default used: raise to high, wait, then — if the ticket is STILL
    open/in_progress (fresh-state branch, so a resolved ticket stops climbing,
    exactly like the old job's status filter) — raise to urgent. This is the
    faithful flow-expressible reconstruction of "step the priority up over time
    while the ticket is unresolved"; ``update_ticket`` can only set an absolute
    priority (not "one notch up"), so the ladder is high→urgent rather than the
    old per-notch climb from whatever the starting priority was.

    Kept as a plain dict so the FLOW10 migration (raw SQL) and the tests reuse the
    exact same shape. The engine accepts either the linear list or this graph."""
    _still_open = [[{"field": "status", "op": "in", "value": ["open", "in_progress"]}]]
    return {
        "nodes": [
            {"id": "check_open_1", "type": "branch", "config": {"conditions": _still_open}},
            {"id": "to_high", "type": "update_ticket", "config": {"priority": "high"}},
            {"id": "wait_1", "type": "wait", "config": {"minutes": 5}},
            {"id": "check_open_2", "type": "branch", "config": {"conditions": _still_open}},
            {"id": "to_urgent", "type": "update_ticket", "config": {"priority": "urgent"}},
        ],
        "edges": [
            {"from": "check_open_1", "to": "to_high", "when": "match"},
            {"from": "to_high", "to": "wait_1", "when": None},
            {"from": "wait_1", "to": "check_open_2", "when": None},
            {"from": "check_open_2", "to": "to_urgent", "when": "match"},
        ],
    }


# [FLOW8] The two universal default flows every tenant gets — replacements for the
# retired Yip SLA nudge (B1) and the SLA escalation job (B2). Installed for every
# existing tenant by the FLOW8 migration and for every new tenant by seed.py /
# create_tenant. Kept as plain dicts so the migration (raw SQL) and the tests can
# reuse the exact same shapes. tickets is a paid add-on, but a tenant without it
# simply never receives ticket_sla_due_soon events — the flow stays inert, so it's
# safe to install unconditionally.
#
# [SLA restore] The escalation flow now carries the STEPWISE post-breach ladder
# (stepwise_sla_escalation_graph) instead of FLOW8's one-shot jump to urgent. The
# FLOW10 migration moves existing tenants' migrated flow back to this shape; the
# one-shot "urgent, 60 min before breach" variant stays available as the opt-in
# recipe "escalate_before_sla_breach" for new setups that prefer it.
DEFAULT_FLOWS: list[dict] = [
    {
        "name": "Notify the assigned agent before SLA breach",
        "trigger_type": "ticket_sla_due_soon",
        "conditions": [],
        "actions": [
            {"type": "notify_user", "config": {
                "recipient": "assigned agent",
                "message": 'Ticket "{subject}" SLA is due in {due_in_minutes} minutes.',
            }},
        ],
    },
    {
        "name": "Escalate tickets before SLA breach",
        "trigger_type": "ticket_sla_due_soon",
        "conditions": [],
        "actions": stepwise_sla_escalation_graph(),
    },
]


def _default_flow_actions(actions):
    """Normalize a DEFAULT_FLOWS ``actions`` entry — a linear list of action dicts
    or an already-shaped [FLOW4] graph — into the JSONB the Flow row stores,
    validating it through the same specs the API uses."""
    from app.modules.flows.schemas import ActionSpec, GraphSpec

    if isinstance(actions, dict):
        return GraphSpec(**actions).dump()
    return [ActionSpec(**a).model_dump() for a in actions]


async def install_default_flows(db: AsyncSession, tenant_id: uuid.UUID) -> int:
    """Idempotently install the two universal default flows for a tenant. A flow
    is created only when the tenant has no flow of that name yet, so re-running is
    safe. Returns how many were newly created."""
    existing = set((await db.scalars(
        select(Flow.name).where(Flow.tenant_id == tenant_id)
    )).all())
    created = 0
    for spec in DEFAULT_FLOWS:
        if spec["name"] in existing:
            continue
        db.add(Flow(
            tenant_id=tenant_id,
            name=spec["name"],
            enabled=True,
            is_default=True,
            trigger_type=spec["trigger_type"],
            conditions=spec["conditions"],
            actions=_default_flow_actions(spec["actions"]),
            trigger_config={},
            created_by=None,
        ))
        created += 1
    if created:
        await db.commit()
    return created


class FlowValidationError(ValueError):
    """Raised when a flow can't be enabled (incomplete config, dangling ids,
    module not available). Draft (disabled) flows may be incomplete."""


def _new_token() -> str:
    """A URL-safe secret for the inbound webhook path / the tenant signing key."""
    return secrets.token_urlsafe(32)


# [FLOW8] Trigger-specific config is now validated at SAVE time for EVERY trigger
# type, not just `schedule`. Previously only schedule ran through a spec while
# every other trigger's config was silently dropped — so a typo'd or hostile
# config key persisted (or vanished without a word) and, at worst, only surfaced
# when the engine interpreted it. Each trigger now names the pydantic spec its
# config must satisfy; specs forbid unknown keys, so a bad config is a clean 422.
# A trigger with no bespoke config uses the base spec (chainable only).
_TRIGGER_CONFIG_SPECS: dict[str, type] = {"schedule": ScheduleConfigSpec}


def _config_spec_for(trigger_type: str) -> type:
    from app.modules.flows.schemas import BaseTriggerConfigSpec

    return _TRIGGER_CONFIG_SPECS.get(trigger_type, BaseTriggerConfigSpec)


def _normalize_trigger_config(trigger_type: str, raw: Optional[dict], *, enabled: bool) -> dict:
    """The stored, validated trigger_config. `schedule` carries its frequency/
    time/weekday (validated + weekday-normalized via ScheduleConfigSpec); every
    other trigger carries only the universal `chainable` opt-in. The config is
    validated against the trigger's registered spec on write, so an unknown key
    or an invalid value is rejected (FlowValidationError → 422) rather than
    silently dropped or deferred to the engine.

    A disabled schedule flow may still be saved with an empty config (draft);
    enabling one requires a valid schedule.

    [FLOW6] `chainable: true` survives normalization for every trigger type —
    it's the per-flow opt-in that lets flow-caused events fire this flow."""
    raw = raw or {}
    chainable = bool(raw.get("chainable"))
    spec = _config_spec_for(trigger_type)
    # The bespoke config keys (everything except the universal chainable flag).
    bespoke = {k: v for k, v in raw.items() if k != "chainable"}
    out: dict = {}
    if trigger_type == "schedule":
        # A draft schedule with no config is allowed; an enabled one (or any
        # non-empty config) must fully validate.
        if enabled or bespoke:
            try:
                out = spec(**bespoke).model_dump()
            except ValidationError:
                raise FlowValidationError(
                    "This schedule needs a valid time (HH:MM); a weekly schedule also needs a weekday"
                )
    else:
        # Non-schedule triggers accept no bespoke config — validate to reject any
        # stray key (the base spec forbids extras) rather than dropping it silently.
        try:
            spec(**bespoke)
        except ValidationError:
            raise FlowValidationError(
                "This trigger takes no configuration"
                + (f" — unexpected setting(s): {', '.join(sorted(bespoke))}" if bespoke else "")
            )
    if chainable:
        out["chainable"] = True
    return out


async def list_flows(db: AsyncSession, tenant_id: uuid.UUID) -> list[Flow]:
    result = await db.execute(
        select(Flow).where(Flow.tenant_id == tenant_id).order_by(Flow.created_at.desc())
    )
    flows = list(result.scalars().all())
    await _attach_run_stats(db, tenant_id, flows)
    return flows


async def _attach_run_stats(
    db: AsyncSession, tenant_id: uuid.UUID, flows: list[Flow]
) -> None:
    """Decorate each flow with success_count/fail_count from flow_runs in one
    grouped query (transient attributes read by FlowOut, never persisted)."""
    for flow in flows:
        flow.success_count = 0
        flow.fail_count = 0
    if not flows:
        return
    rows = await db.execute(
        select(FlowRun.flow_id, FlowRun.status, func.count())
        .where(FlowRun.tenant_id == tenant_id)
        .group_by(FlowRun.flow_id, FlowRun.status)
    )
    by_id = {flow.id: flow for flow in flows}
    for flow_id, run_status, count in rows.all():
        flow = by_id.get(flow_id)
        if flow is None:
            continue
        if run_status == "success":
            flow.success_count += count
        elif run_status in _FAIL_STATUSES:
            flow.fail_count += count


async def get_flow(db: AsyncSession, tenant_id: uuid.UUID, flow_id: uuid.UUID) -> Optional[Flow]:
    return await db.scalar(
        select(Flow).where(Flow.tenant_id == tenant_id, Flow.id == flow_id)
    )


# Rough ROI constant — minutes of manual work saved per automated run that did
# something (success or partial). Blended across action types; tune in one place.
MINUTES_SAVED_PER_RUN = 3


async def get_flow_performance(
    db: AsyncSession, tenant_id: uuid.UUID, days: int = 7
) -> dict:
    """Per-flow health + ROI from flow_runs for the Automation tab ([ACTIVITY2]
    Phase 2). Admin-gated at the router."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    # Status tallies per flow within the window
    tally_rows = (
        await db.execute(
            select(FlowRun.flow_id, FlowRun.status, func.count())
            .where(FlowRun.tenant_id == tenant_id, FlowRun.created_at >= since)
            .group_by(FlowRun.flow_id, FlowRun.status)
        )
    ).all()
    tallies: dict = {}
    for flow_id, run_status, count in tally_rows:
        tallies.setdefault(flow_id, {}).update({run_status: count})

    # Most recent error per flow in the window (distinct on flow_id, newest first)
    err_subq = (
        select(FlowRun.flow_id, FlowRun.error, FlowRun.created_at)
        .where(
            FlowRun.tenant_id == tenant_id,
            FlowRun.created_at >= since,
            FlowRun.error.is_not(None),
        )
        .distinct(FlowRun.flow_id)
        .order_by(FlowRun.flow_id, FlowRun.created_at.desc())
        .subquery()
    )
    error_map = {
        r[0]: r[1] for r in (await db.execute(select(err_subq.c.flow_id, err_subq.c.error))).all()
    }

    flow_rows = (
        await db.execute(
            select(Flow.id, Flow.name, Flow.enabled, Flow.trigger_type, Flow.last_run_at)
            .where(Flow.tenant_id == tenant_id)
            .order_by(Flow.name)
        )
    ).all()

    flows = []
    tot = {"success": 0, "partial": 0, "failed": 0, "skipped": 0}
    for fid, name, enabled, trigger_type, last_run_at in flow_rows:
        t = tallies.get(fid, {})
        success = t.get("success", 0)
        partial = t.get("partial", 0)
        failed = t.get("failed", 0)
        skipped = t.get("skipped", 0)
        fires = success + partial + failed
        tot["success"] += success
        tot["partial"] += partial
        tot["failed"] += failed
        tot["skipped"] += skipped
        flows.append(
            {
                "flow_id": str(fid),
                "name": name,
                "enabled": enabled,
                "trigger_type": trigger_type,
                "fires": fires,
                "success": success,
                "partial": partial,
                "failed": failed,
                "skipped": skipped,
                "success_rate": (success / fires) if fires else None,
                "est_hours_saved": round((success + partial) * MINUTES_SAVED_PER_RUN / 60.0, 1),
                "last_error": error_map.get(fid),
                "last_run_at": last_run_at,
            }
        )

    flows.sort(key=lambda f: f["fires"], reverse=True)
    total_fires = tot["success"] + tot["partial"] + tot["failed"]
    return {
        "period_days": days,
        "totals": {
            "fires": total_fires,
            "success": tot["success"],
            "partial": tot["partial"],
            "failed": tot["failed"],
            "skipped": tot["skipped"],
            "success_rate": (tot["success"] / total_fires) if total_fires else None,
            "est_hours_saved": round((tot["success"] + tot["partial"]) * MINUTES_SAVED_PER_RUN / 60.0, 1),
        },
        "flows": flows,
    }


def _required_config_keys(action_type: str) -> list[str]:
    return [
        f["key"] for f in ACTION_META[action_type]["config_fields"] if f.get("required")
    ]


async def _validate_enabled(
    db: AsyncSession, tenant: Tenant, trigger_type: str, actions
) -> None:
    """A flow must be fully wired before it may be enabled. `actions` is either
    the linear list or the [FLOW4] graph — completeness checks iterate the
    executable nodes of either shape."""
    enabled_modules = tenant.enabled_modules or []

    trigger_module = TRIGGER_META[trigger_type]["module"]
    if trigger_module and trigger_module not in enabled_modules:
        raise FlowValidationError(
            f"The '{trigger_module}' module is required for this trigger"
        )
    action_nodes = graph.iter_action_nodes(actions)
    if not action_nodes:
        raise FlowValidationError("An enabled flow needs at least one action")
    # Waits may not trail the flow (on any path) and the longest wait path is
    # capped (each config was already shape-validated by ActionSpec).
    try:
        steps.validate_wait_placement(actions)
    except ValueError as exc:
        raise FlowValidationError(str(exc))

    for action in action_nodes:
        action_type = action["type"]
        config = action.get("config") or {}
        module = ACTION_MODULES[action_type]
        if module and module not in enabled_modules:
            raise FlowValidationError(f"The '{module}' module is required for this action")
        for key in _required_config_keys(action_type):
            if not config.get(key):
                # send_email accepts a template instead of a literal body/subject pair
                if action_type == "send_email" and key == "subject" and config.get("template_id"):
                    continue
                # [FLOW8] notify_user to the "assigned agent" resolves its target
                # from the event, so no user_id needs to be picked (mirrors the
                # send_email template exception above).
                if (
                    action_type == "notify_user"
                    and key == "user_id"
                    and config.get("recipient") == "assigned agent"
                ):
                    continue
                raise FlowValidationError(
                    f"'{ACTION_META[action_type]['label']}' is missing its '{key}' setting"
                )
        # Every referenced id must exist inside this tenant (IDOR discipline —
        # the payload round-trips through the client).
        if config.get("stage_id"):
            from app.modules.pipeline.models import PipelineStage

            found = await db.scalar(select(PipelineStage.id).where(
                PipelineStage.id == uuid.UUID(str(config["stage_id"])),
                PipelineStage.tenant_id == tenant.id,
            ))
            if found is None:
                raise FlowValidationError("The selected pipeline stage no longer exists")
        for user_key in ("user_id", "assigned_to"):
            if config.get(user_key):
                found = await db.scalar(select(User.id).where(
                    User.id == uuid.UUID(str(config[user_key])),
                    User.tenant_id == tenant.id,
                ))
                if found is None:
                    raise FlowValidationError("The selected team member no longer exists")
        if config.get("template_id"):
            from app.modules.tickets.models import ResponseTemplate

            found = await db.scalar(select(ResponseTemplate.id).where(
                ResponseTemplate.id == uuid.UUID(str(config["template_id"])),
                ResponseTemplate.tenant_id == tenant.id,
            ))
            if found is None:
                raise FlowValidationError("The selected template no longer exists")


async def _validate_flow_capacity(
    db: AsyncSession, tenant: Tenant, exclude_flow_id: uuid.UUID | None = None
) -> None:
    """The plan's active-flow cap (PLAN_LIMITS["flows"], None == unlimited),
    checked whenever a flow is about to become enabled. Only ENABLED, non
    default flows count — drafts are free, and the Yippie installed default
    flows never occupy a slot (deleting one frees nothing either)."""
    limit = limits_for_plan(tenant.plan).get("flows")
    if limit is None:
        return
    query = (
        select(func.count()).select_from(Flow).where(
            Flow.tenant_id == tenant.id,
            Flow.enabled.is_(True),
            Flow.is_default.is_(False),
        )
    )
    if exclude_flow_id is not None:
        query = query.where(Flow.id != exclude_flow_id)
    current = await db.scalar(query)
    if (current or 0) >= limit:
        raise FlowValidationError(
            f"Your {(tenant.plan or 'current').title()} plan is limited to {limit} "
            "active flows. Disable another flow or upgrade to enable more."
        )


async def create_flow(
    db: AsyncSession, tenant: Tenant, created_by: uuid.UUID, data: FlowCreate
) -> Flow:
    conditions = [[c.model_dump() for c in group] for group in data.conditions]
    actions = dump_actions(data.actions)
    trigger_config = _normalize_trigger_config(
        data.trigger_type, data.trigger_config, enabled=data.enabled
    )
    if data.enabled:
        await _validate_flow_capacity(db, tenant)
        await _validate_enabled(db, tenant, data.trigger_type, actions)
    flow = Flow(
        tenant_id=tenant.id,
        name=data.name,
        enabled=data.enabled,
        trigger_type=data.trigger_type,
        trigger_config=trigger_config,
        conditions=conditions,
        actions=actions,
        created_by=created_by,
    )
    # [FLOW5] a webhook-trigger flow needs its inbound token from the start so
    # the builder can show the URL immediately.
    if data.trigger_type == "webhook":
        flow.webhook_token = _new_token()
    db.add(flow)
    await db.commit()
    await db.refresh(flow)
    return flow


async def update_flow(db: AsyncSession, tenant: Tenant, flow: Flow, data: FlowUpdate) -> Flow:
    provided = data.model_dump(exclude_unset=True)
    was_enabled = flow.enabled
    if "name" in provided:
        flow.name = data.name
    if "trigger_type" in provided:
        flow.trigger_type = data.trigger_type
    if "conditions" in provided:
        flow.conditions = [[c.model_dump() for c in group] for group in data.conditions]
    if "actions" in provided:
        flow.actions = dump_actions(data.actions)
    if "trigger_config" in provided:
        flow.trigger_config = data.trigger_config
    if "enabled" in provided:
        flow.enabled = data.enabled
    # Re-normalize against the FINAL trigger_type/config/enabled (any of which
    # this update may have changed): non-schedule triggers drop config, an
    # enabled schedule flow must carry a valid one.
    flow.trigger_config = _normalize_trigger_config(
        flow.trigger_type, flow.trigger_config, enabled=flow.enabled
    )
    # [FLOW5] mint the inbound token if this update turned the flow into a
    # webhook flow (switching away leaves the old token dormant — harmless).
    if flow.trigger_type == "webhook" and not flow.webhook_token:
        flow.webhook_token = _new_token()
    if flow.enabled:
        # The cap is a turn-ON gate only (default flows are exempt): an already
        # enabled flow stays editable even when a downgrade left the tenant
        # over their limit.
        if not was_enabled and not flow.is_default:
            await _validate_flow_capacity(db, tenant, exclude_flow_id=flow.id)
        await _validate_enabled(db, tenant, flow.trigger_type, flow.actions)
    await db.commit()
    await db.refresh(flow)
    return flow


async def delete_flow(db: AsyncSession, flow: Flow) -> None:
    await db.delete(flow)
    await db.commit()


async def duplicate_flow(
    db: AsyncSession, tenant: Tenant, created_by: uuid.UUID, flow: Flow
) -> Flow:
    """Clone a flow's wiring into a fresh, disabled copy (run counters reset).
    Disabled so the operator reviews/renames before it starts firing — no
    completeness validation needed."""
    copy = Flow(
        tenant_id=tenant.id,
        name=f"{flow.name} (copy)"[:255],
        enabled=False,
        trigger_type=flow.trigger_type,
        trigger_config=flow.trigger_config or {},
        conditions=flow.conditions or [],
        actions=flow.actions or [],
        created_by=created_by,
    )
    db.add(copy)
    await db.commit()
    await db.refresh(copy)
    copy.success_count = 0
    copy.fail_count = 0
    return copy


def test_fire(tenant: Tenant, flow: Flow) -> dict:
    """Dry-run a flow against a synthesized sample event — evaluate its
    conditions and report which actions would run, executing nothing."""
    return preview.dry_run(
        flow.trigger_type, flow.conditions, flow.actions, tenant.enabled_modules or []
    )


def _inbound_url(base_url: str, token: Optional[str]) -> Optional[str]:
    return f"{base_url}/api/v1/flows/hook/{token}" if token else None


async def webhook_config(db: AsyncSession, tenant: Tenant, flow: Flow, base_url: str) -> dict:
    """[FLOW5] The inbound URL + outbound signing secret for a webhook flow.
    Mints the flow's token and the tenant's signing secret if either is missing
    (the panel is only shown for webhook flows)."""
    if not flow.webhook_token:
        flow.webhook_token = _new_token()
    if not tenant.flow_webhook_secret:
        tenant.flow_webhook_secret = _new_token()
    await db.commit()
    return {
        "inbound_url": _inbound_url(base_url, flow.webhook_token),
        "signing_secret": tenant.flow_webhook_secret,
    }


async def rotate_webhook_token(db: AsyncSession, flow: Flow, base_url: str) -> dict:
    """Regenerate the inbound token — the old URL stops working immediately."""
    flow.webhook_token = _new_token()
    await db.commit()
    return {"inbound_url": _inbound_url(base_url, flow.webhook_token)}


async def rotate_signing_secret(db: AsyncSession, tenant: Tenant) -> dict:
    """Regenerate the tenant's outbound signing secret — receivers must update."""
    tenant.flow_webhook_secret = _new_token()
    await db.commit()
    return {"signing_secret": tenant.flow_webhook_secret}


async def get_flow_by_token(db: AsyncSession, token: str) -> Optional[Flow]:
    """Resolve a webhook flow by its inbound token, RLS-bypassed (the public
    handler has no tenant context yet). Only enabled webhook flows fire."""
    from sqlalchemy import text

    await db.execute(text("SET LOCAL row_security = off"))
    return await db.scalar(select(Flow).where(Flow.webhook_token == token))


async def list_runs(
    db: AsyncSession, tenant_id: uuid.UUID, flow_id: uuid.UUID,
    limit: int = 25, status: Optional[str] = None,
) -> list[FlowRun]:
    query = select(FlowRun).where(
        FlowRun.tenant_id == tenant_id, FlowRun.flow_id == flow_id
    )
    if status:
        query = query.where(FlowRun.status == status)
    result = await db.execute(
        query.order_by(FlowRun.created_at.desc()).limit(min(limit, 100))
    )
    return list(result.scalars().all())


async def build_meta(db: AsyncSession, tenant: Tenant) -> dict:
    """Everything the builder UI needs in one call, filtered to the tenant's
    enabled modules so it never offers a trigger or action that can't run."""
    enabled_modules = tenant.enabled_modules or []

    triggers = [
        {
            "key": key,
            "label": meta["label"],
            # [FLOW7] the emitting module — the picker groups triggers by it. The
            # explicit key construction keeps fetch_fields/example_payload out of
            # the API response.
            "module": meta["module"],
            # Canonical display label from packages/config/modules.json, so the
            # frontend never needs its own module → label map for the picker.
            "module_label": (
                MODULE_META.get(meta["module"], {}).get("label")
                if meta["module"] else None
            ),
            "fields": meta["fields"],
            # [FLOW5] webhook payload keys are unknown at build time — the builder
            # renders a free-text field name input when this is set.
            "free_fields": meta.get("free_fields", False),
        }
        for key, meta in TRIGGER_META.items()
        if not meta["module"] or meta["module"] in enabled_modules
    ]
    actions = [
        {"key": key, "label": meta["label"], "config_fields": meta["config_fields"]}
        for key, meta in ACTION_META.items()
        if not meta["module"] or meta["module"] in enabled_modules
    ]

    users_result = await db.execute(
        select(User.id, User.full_name).where(
            User.tenant_id == tenant.id, User.is_active.is_(True)
        ).order_by(User.full_name)
    )
    users = [{"id": str(uid), "name": name} for uid, name in users_result.all()]

    stages = []
    if "pipeline" in enabled_modules:
        from app.modules.pipeline.models import PipelineStage

        stages_result = await db.execute(
            select(PipelineStage.id, PipelineStage.name)
            .where(PipelineStage.tenant_id == tenant.id)
            .order_by(PipelineStage.display_order)
        )
        stages = [{"id": str(sid), "name": name} for sid, name in stages_result.all()]

    templates = []
    if "tickets" in enabled_modules:
        from app.modules.tickets.models import ResponseTemplate

        templates_result = await db.execute(
            select(ResponseTemplate.id, ResponseTemplate.name)
            .where(ResponseTemplate.tenant_id == tenant.id)
            .order_by(ResponseTemplate.name)
        )
        templates = [{"id": str(tid), "name": name} for tid, name in templates_result.all()]

    # [FLOW8] the always-on platform automations, filtered to the tenant's modules.
    from app.modules.flows.builtins import builtins_for

    return {
        "triggers": triggers,
        "actions": actions,
        "users": users,
        "stages": stages,
        "templates": templates,
        "builtins": builtins_for(enabled_modules),
    }


def list_recipes(tenant: Tenant) -> list[dict]:
    enabled_modules = tenant.enabled_modules or []

    def _available(recipe: dict) -> bool:
        trigger_module = TRIGGER_META[recipe["trigger_type"]]["module"]
        if trigger_module and trigger_module not in enabled_modules:
            return False
        return all(
            not ACTION_MODULES[a["type"]] or ACTION_MODULES[a["type"]] in enabled_modules
            for a in recipe["actions"]
        )

    return [r for r in RECIPES if _available(r)]


async def install_recipe(
    db: AsyncSession, tenant: Tenant, created_by: uuid.UUID, key: str
) -> Flow:
    recipe = RECIPES_BY_KEY.get(key)
    if recipe is None:
        raise KeyError(key)
    # Installed disabled: tenant-specific ids (stage, user) still need choosing
    # in the builder, and enabling runs the completeness validation.
    flow = Flow(
        tenant_id=tenant.id,
        name=recipe["name"],
        enabled=False,
        trigger_type=recipe["trigger_type"],
        conditions=recipe["conditions"],
        actions=recipe["actions"],
        created_by=created_by,
    )
    db.add(flow)
    await db.commit()
    await db.refresh(flow)
    return flow
