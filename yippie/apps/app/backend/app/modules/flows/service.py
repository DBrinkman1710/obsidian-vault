from __future__ import annotations

import uuid
from typing import Optional

from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Tenant, User
from app.modules.flows import steps
from app.modules.flows.actions import ACTION_META, ACTION_MODULES
from app.modules.flows.conditions import TRIGGER_META
from app.modules.flows.models import Flow, FlowRun
from app.modules.flows.recipes import RECIPES, RECIPES_BY_KEY
from app.modules.flows.schemas import FlowCreate, FlowUpdate, ScheduleConfigSpec


class FlowValidationError(ValueError):
    """Raised when a flow can't be enabled (incomplete config, dangling ids,
    module not available). Draft (disabled) flows may be incomplete."""


def _normalize_trigger_config(trigger_type: str, raw: Optional[dict], *, enabled: bool) -> dict:
    """The stored trigger_config: {} for every trigger except `schedule`, whose
    config is validated (and its weekday normalized) through ScheduleConfigSpec.
    A disabled schedule flow may still be saved with an empty config (draft);
    enabling one requires a valid schedule."""
    if trigger_type != "schedule":
        return {}
    raw = raw or {}
    if not enabled and not raw:
        return {}
    try:
        return ScheduleConfigSpec(**raw).model_dump()
    except ValidationError:
        raise FlowValidationError(
            "This schedule needs a valid time (HH:MM); a weekly schedule also needs a weekday"
        )


async def list_flows(db: AsyncSession, tenant_id: uuid.UUID) -> list[Flow]:
    result = await db.execute(
        select(Flow).where(Flow.tenant_id == tenant_id).order_by(Flow.created_at.desc())
    )
    return list(result.scalars().all())


async def get_flow(db: AsyncSession, tenant_id: uuid.UUID, flow_id: uuid.UUID) -> Optional[Flow]:
    return await db.scalar(
        select(Flow).where(Flow.tenant_id == tenant_id, Flow.id == flow_id)
    )


def _required_config_keys(action_type: str) -> list[str]:
    return [
        f["key"] for f in ACTION_META[action_type]["config_fields"] if f.get("required")
    ]


async def _validate_enabled(
    db: AsyncSession, tenant: Tenant, trigger_type: str, actions: list[dict]
) -> None:
    """A flow must be fully wired before it may be enabled."""
    enabled_modules = tenant.enabled_modules or []

    trigger_module = TRIGGER_META[trigger_type]["module"]
    if trigger_module and trigger_module not in enabled_modules:
        raise FlowValidationError(
            f"The '{trigger_module}' module is required for this trigger"
        )
    if not actions:
        raise FlowValidationError("An enabled flow needs at least one action")
    # Waits may not trail the flow and their total is capped (each config was
    # already shape-validated by ActionSpec).
    try:
        steps.validate_wait_placement(actions)
    except ValueError as exc:
        raise FlowValidationError(str(exc))

    for action in actions:
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


async def create_flow(
    db: AsyncSession, tenant: Tenant, created_by: uuid.UUID, data: FlowCreate
) -> Flow:
    conditions = [[c.model_dump() for c in group] for group in data.conditions]
    actions = [a.model_dump() for a in data.actions]
    trigger_config = _normalize_trigger_config(
        data.trigger_type, data.trigger_config, enabled=data.enabled
    )
    if data.enabled:
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
    db.add(flow)
    await db.commit()
    await db.refresh(flow)
    return flow


async def update_flow(db: AsyncSession, tenant: Tenant, flow: Flow, data: FlowUpdate) -> Flow:
    provided = data.model_dump(exclude_unset=True)
    if "name" in provided:
        flow.name = data.name
    if "trigger_type" in provided:
        flow.trigger_type = data.trigger_type
    if "conditions" in provided:
        flow.conditions = [[c.model_dump() for c in group] for group in data.conditions]
    if "actions" in provided:
        flow.actions = [a.model_dump() for a in data.actions]
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
    if flow.enabled:
        await _validate_enabled(db, tenant, flow.trigger_type, flow.actions)
    await db.commit()
    await db.refresh(flow)
    return flow


async def delete_flow(db: AsyncSession, flow: Flow) -> None:
    await db.delete(flow)
    await db.commit()


async def list_runs(
    db: AsyncSession, tenant_id: uuid.UUID, flow_id: uuid.UUID, limit: int = 25
) -> list[FlowRun]:
    result = await db.execute(
        select(FlowRun)
        .where(FlowRun.tenant_id == tenant_id, FlowRun.flow_id == flow_id)
        .order_by(FlowRun.created_at.desc())
        .limit(min(limit, 100))
    )
    return list(result.scalars().all())


async def build_meta(db: AsyncSession, tenant: Tenant) -> dict:
    """Everything the builder UI needs in one call, filtered to the tenant's
    enabled modules so it never offers a trigger or action that can't run."""
    enabled_modules = tenant.enabled_modules or []

    triggers = [
        {"key": key, "label": meta["label"], "fields": meta["fields"]}
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

    return {
        "triggers": triggers,
        "actions": actions,
        "users": users,
        "stages": stages,
        "templates": templates,
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
