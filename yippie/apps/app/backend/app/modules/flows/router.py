from __future__ import annotations

import json
import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import CurrentUser, require_admin
from app.config import get_settings
from app.core.flow_events import emit_flow_event
from app.core.models import Tenant, User
from app.core.rate_limit import rl_hit, rl_is_blocked
from app.database import get_db
from app.modules.flows import service, webhooks
from app.modules.flows.schemas import (
    FlowCreate,
    FlowOut,
    FlowRunOut,
    FlowUpdate,
    RecipeOut,
)
from app.modules.flows.service import FlowValidationError

log = logging.getLogger(__name__)

router = APIRouter(prefix="/flows", tags=["flows"])
# Public inbound webhook — no auth, resolved by the per-flow token. Mounted
# separately (before the module-gated routes) in main.py.
webhook_router = APIRouter(prefix="/flows", tags=["flows-webhooks"])
DB = Annotated[AsyncSession, Depends(get_db)]
AdminUser = Annotated[User, Depends(require_admin)]

# Per-token inbound rate limit: generous enough for busy integrations, tight
# enough to bound an outbound→external→inbound loop ([FLOW6]'s chain_depth guard
# can't see across an external hop, so this is the only backstop there).
_HOOK_RATE_LIMIT = 120
_HOOK_RATE_WINDOW = 60


async def _load_tenant(db: AsyncSession, tenant_id: uuid.UUID) -> Tenant:
    tenant = await db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    return tenant


@router.get("", response_model=list[FlowOut])
async def list_flows(current_user: CurrentUser, db: DB):
    return await service.list_flows(db, current_user.tenant_id)


@router.post("", response_model=FlowOut, status_code=status.HTTP_201_CREATED)
async def create_flow(body: FlowCreate, current_user: AdminUser, db: DB):
    tenant = await _load_tenant(db, current_user.tenant_id)
    try:
        return await service.create_flow(db, tenant, current_user.id, body)
    except FlowValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


# Static paths declared before "/{flow_id}" so FastAPI does not read them as UUIDs.
@router.get("/meta")
async def get_meta(current_user: CurrentUser, db: DB):
    tenant = await _load_tenant(db, current_user.tenant_id)
    return await service.build_meta(db, tenant)


@router.get("/recipes", response_model=list[RecipeOut])
async def list_recipes(current_user: CurrentUser, db: DB):
    tenant = await _load_tenant(db, current_user.tenant_id)
    return service.list_recipes(tenant)


@router.post("/recipes/{key}/install", response_model=FlowOut, status_code=status.HTTP_201_CREATED)
async def install_recipe(key: str, current_user: AdminUser, db: DB):
    tenant = await _load_tenant(db, current_user.tenant_id)
    try:
        return await service.install_recipe(db, tenant, current_user.id, key)
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")


@router.post("/webhook_secret/rotate")
async def rotate_signing_secret(current_user: AdminUser, db: DB):
    """Rotate the tenant-wide outbound signing secret ([FLOW5] send_webhook)."""
    tenant = await _load_tenant(db, current_user.tenant_id)
    return await service.rotate_signing_secret(db, tenant)


@router.get("/performance")
async def flow_performance(current_user: AdminUser, db: DB, days: int = Query(7, ge=1, le=365)):
    """Per-flow health + ROI for the Automation tab. Admin/superadmin only."""
    return await service.get_flow_performance(db, current_user.tenant_id, days)


@router.get("/{flow_id}/webhook")
async def get_webhook_config(flow_id: uuid.UUID, current_user: AdminUser, db: DB):
    """Inbound URL + outbound signing secret for a webhook-trigger flow."""
    flow = await service.get_flow(db, current_user.tenant_id, flow_id)
    if flow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flow not found")
    tenant = await _load_tenant(db, current_user.tenant_id)
    base_url = get_settings().effective_base_url
    return await service.webhook_config(db, tenant, flow, base_url)


@router.post("/{flow_id}/webhook/rotate")
async def rotate_webhook_token(flow_id: uuid.UUID, current_user: AdminUser, db: DB):
    """Regenerate a flow's inbound token — the previous URL stops working."""
    flow = await service.get_flow(db, current_user.tenant_id, flow_id)
    if flow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flow not found")
    base_url = get_settings().effective_base_url
    return await service.rotate_webhook_token(db, flow, base_url)


@router.get("/{flow_id}/runs", response_model=list[FlowRunOut])
async def list_flow_runs(
    flow_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    limit: int = Query(25, ge=1, le=100),
    run_status: str | None = Query(None, alias="status"),
):
    flow = await service.get_flow(db, current_user.tenant_id, flow_id)
    if flow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flow not found")
    return await service.list_runs(db, current_user.tenant_id, flow_id, limit, run_status)


@router.post("/{flow_id}/duplicate", response_model=FlowOut, status_code=status.HTTP_201_CREATED)
async def duplicate_flow(flow_id: uuid.UUID, current_user: AdminUser, db: DB):
    flow = await service.get_flow(db, current_user.tenant_id, flow_id)
    if flow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flow not found")
    tenant = await _load_tenant(db, current_user.tenant_id)
    return await service.duplicate_flow(db, tenant, current_user.id, flow)


@router.post("/{flow_id}/test")
async def test_fire_flow(flow_id: uuid.UUID, current_user: AdminUser, db: DB):
    flow = await service.get_flow(db, current_user.tenant_id, flow_id)
    if flow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flow not found")
    tenant = await _load_tenant(db, current_user.tenant_id)
    return service.test_fire(tenant, flow)


@router.patch("/{flow_id}", response_model=FlowOut)
async def update_flow(flow_id: uuid.UUID, body: FlowUpdate, current_user: AdminUser, db: DB):
    flow = await service.get_flow(db, current_user.tenant_id, flow_id)
    if flow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flow not found")
    # [FLOW9] Default flows are view only showcases: they may be switched on/off
    # or deleted, but their wiring can't change — duplicate one to customise it.
    if flow.is_default and set(body.model_dump(exclude_unset=True)) - {"enabled"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This default flow is view only — duplicate it to make an editable copy.",
        )
    tenant = await _load_tenant(db, current_user.tenant_id)
    try:
        return await service.update_flow(db, tenant, flow, body)
    except FlowValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


@router.delete("/{flow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_flow(flow_id: uuid.UUID, current_user: AdminUser, db: DB):
    flow = await service.get_flow(db, current_user.tenant_id, flow_id)
    if flow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flow not found")
    await service.delete_flow(db, flow)


# --------------------------------------------------------------- inbound hook

@webhook_router.post("/hook/{token}", include_in_schema=False)
async def inbound_webhook(token: str, request: Request, db: DB):
    """[FLOW5] Public entry point for a webhook-trigger flow. Rate-limited PER
    TOKEN, size-capped, and it only ever emits into the outbox — the engine does
    all the work on its own tick, so a slow/failing flow never blocks the caller.

    Returns are deliberately terse: 202 accepted, 404 unknown token, 413 too
    large, 400 bad JSON, 429 rate-limited."""
    rl_key = f"flow_hook:{token}"
    if await rl_is_blocked(rl_key, _HOOK_RATE_LIMIT, _HOOK_RATE_WINDOW):
        return Response(status_code=status.HTTP_429_TOO_MANY_REQUESTS)
    await rl_hit(rl_key, _HOOK_RATE_WINDOW)

    body = await request.body()
    if len(body) > webhooks.MAX_PAYLOAD_BYTES:
        return Response(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)

    flow = await service.get_flow_by_token(db, token)
    if flow is None:
        return Response(status_code=status.HTTP_404_NOT_FOUND)
    # The token identifies the flow; only fire it when it's still a live webhook
    # flow on a tenant that still has the module. (Disabled flows are filtered
    # again by the engine, but skipping the emit avoids pointless outbox rows.)
    if not flow.enabled or flow.trigger_type != "webhook":
        return Response(status_code=status.HTTP_202_ACCEPTED)
    tenant = await db.get(Tenant, flow.tenant_id)
    if tenant is None or "flows" not in (tenant.enabled_modules or []):
        return Response(status_code=status.HTTP_202_ACCEPTED)

    try:
        parsed = json.loads(body) if body else {}
    except ValueError:
        return Response(status_code=status.HTTP_400_BAD_REQUEST)
    fields = webhooks.flatten_payload(parsed)

    await emit_flow_event(
        db, flow.tenant_id, "webhook",
        entity_type="webhook",
        payload={**fields, "flow_id": str(flow.id)},
    )
    await db.commit()
    return Response(status_code=status.HTTP_202_ACCEPTED)
