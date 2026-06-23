from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

import re

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import select as sa_select

from app.auth.dependencies import SuperAdminUser
from app.config import get_settings
from app.core.models import Tenant
from app.database import get_db
from app.modules.admin import schemas, service

router = APIRouter(prefix="/admin", tags=["admin"])

DB = Annotated[AsyncSession, Depends(get_db)]


@router.get("/tenants", response_model=list[schemas.TenantOut])
async def list_tenants(_: SuperAdminUser, db: DB):
    return await service.list_tenants(db)


@router.get("/stats", response_model=schemas.SuperAdminStats)
async def get_stats(
    _: SuperAdminUser,
    db: DB,
    start: datetime | None = None,
    end: datetime | None = None,
    tenant_id: uuid.UUID | None = None,
):
    """Cross-tenant activity dashboard data. Superadmin-only, read-only.

    `start`/`end` are ISO datetimes filtering date-ranged counts (default: last 7
    days). `tenant_id` narrows the result to a single tenant."""
    now = datetime.now(timezone.utc)
    if end is None:
        end = now
    if start is None:
        start = end - timedelta(days=7)
    return await service.get_superadmin_stats(db, start, end, tenant_id)


@router.get("/check-email")
async def check_email(_: SuperAdminUser, db: DB, email: str = ""):
    """Inline validation for the create-client / add-admin forms: validates the
    format and whether the address is already taken, as the user types (on blur),
    instead of failing on submit."""
    available, reason = await service.check_email_available(db, email)
    return {"available": available, "reason": reason}


@router.get("/check-slug")
async def check_slug(_: SuperAdminUser, db: DB, slug: str = ""):
    """Real-time slug availability check for the create-client form."""
    import re as _re
    slug = (slug or "").strip().lower()
    if not slug:
        return {"available": False, "reason": "Slug is required"}
    if not _re.match(r'^[a-z0-9][a-z0-9-]*[a-z0-9]$', slug) or len(slug) < 2:
        return {"available": False, "reason": "Only lowercase letters, numbers, and hyphens; min 2 chars"}
    existing = await db.scalar(sa_select(Tenant.id).where(Tenant.slug == slug))
    if existing:
        return {"available": False, "reason": f"Slug '{slug}' is already taken"}
    return {"available": True, "reason": None}


@router.post("/tenants", response_model=schemas.TenantOut, status_code=status.HTTP_201_CREATED)
async def create_tenant(_: SuperAdminUser, db: DB, data: schemas.TenantCreate):
    try:
        return await service.create_tenant(db, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.patch("/tenants/{tenant_id}", response_model=schemas.TenantOut)
async def update_tenant(_: SuperAdminUser, db: DB, tenant_id: uuid.UUID, data: schemas.TenantUpdate):
    tenant = await service.update_tenant(db, tenant_id, data)
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


@router.post("/tenants/{tenant_id}/delete")
async def delete_tenant(current_user: SuperAdminUser, db: DB, tenant_id: uuid.UUID, data: schemas.DeleteRequest):
    """Wipe a tenant and all its data — root owner + password confirmation. Irreversible."""
    try:
        return await service.delete_tenant(db, current_user, tenant_id, data.current_password)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/tenants/{tenant_id}/users", response_model=list[schemas.TenantUserOut])
async def get_tenant_users(_: SuperAdminUser, db: DB, tenant_id: uuid.UUID):
    return await service.get_tenant_users(db, tenant_id)


@router.post("/tenants/{tenant_id}/users", status_code=status.HTTP_201_CREATED)
async def add_tenant_user(_: SuperAdminUser, db: DB, tenant_id: uuid.UUID, data: schemas.AddAdminRequest):
    try:
        user = await service.add_tenant_user(db, tenant_id, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    if user is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if isinstance(user, dict):
        return user  # {"invited": True, "email": ...}
    return schemas.TenantUserOut.model_validate(user)


@router.patch("/tenants/{tenant_id}/users/{user_id}", response_model=schemas.TenantUserOut)
async def patch_tenant_user(_: SuperAdminUser, db: DB, tenant_id: uuid.UUID, user_id: uuid.UUID, data: schemas.PatchTenantUserRequest):
    user = await service.patch_tenant_user(db, tenant_id, user_id, data.is_active)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("/tenants/{tenant_id}/impersonate")
async def impersonate_tenant(current_superadmin: SuperAdminUser, db: DB, tenant_id: uuid.UUID):
    """Mint a short-lived token for the tenant's first active admin, so a
    superadmin can view the client's environment without their password."""
    import logging as _logging
    _log = _logging.getLogger(__name__)

    result = await service.get_impersonation_target(db, tenant_id)
    if result is None:
        raise HTTPException(status_code=404, detail="No active admin user in this tenant")
    tenant, user = result

    from app.auth.router import create_access_token
    from datetime import timedelta

    token = create_access_token(str(user.id), get_settings(), expires=timedelta(hours=1), imp=True)
    _log.warning(
        "IMPERSONATION: superadmin %s (%s) impersonated tenant %s (user %s)",
        current_superadmin.email, str(current_superadmin.id), tenant.name, user.email,
    )
    return {
        "access_token": token,
        "impersonated_tenant_name": tenant.name,
        "impersonated_user_email": user.email,
    }


@router.post("/promote-superadmin", response_model=schemas.TenantUserOut)
async def promote_superadmin(current_user: SuperAdminUser, db: DB, data: schemas.PromoteSuperadminRequest):
    try:
        user = await service.promote_superadmin(db, current_user, data.target_email, data.current_password)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return user


@router.get("/superadmins", response_model=list[schemas.SuperadminOut])
async def list_superadmins(_: SuperAdminUser, db: DB):
    return await service.list_superadmins(db)


@router.patch("/superadmins/{user_id}", response_model=schemas.SuperadminOut)
async def toggle_superadmin(
    current_user: SuperAdminUser, db: DB, user_id: uuid.UUID,
    data: schemas.ToggleSuperadminRequest,
):
    try:
        return await service.toggle_superadmin_active(db, current_user, user_id, data.is_active, data.current_password)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/superadmins/invite")
async def invite_superadmin(current_user: SuperAdminUser, db: DB, data: schemas.InviteSuperadminRequest):
    """Invite a new superadmin — root owner + password confirmation."""
    try:
        return await service.invite_superadmin(db, current_user, data.email, data.full_name, data.current_password)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.post("/superadmins/{user_id}/delete")
async def delete_superadmin(current_user: SuperAdminUser, db: DB, user_id: uuid.UUID, data: schemas.DeleteRequest):
    """Permanently remove a superadmin — root owner + password confirmation."""
    try:
        return await service.delete_superadmin(db, current_user, user_id, data.current_password)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/modules")
async def bulk_toggle_module(_: SuperAdminUser, db: DB, data: schemas.BulkModuleRequest):
    """Enable or disable a module for every tenant in this database."""
    return await service.bulk_toggle_module(db, data.module, data.enabled)


@router.post("/tenants/{tenant_id}/broadcast", response_model=schemas.BroadcastResult)
async def broadcast_to_tenant(
    _: SuperAdminUser, db: DB, tenant_id: uuid.UUID, data: schemas.BroadcastRequest
):
    """Send a bulk email to all opted-in contacts of a tenant. Superadmin-only."""
    try:
        return await service.broadcast_to_tenant(db, tenant_id, data)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/tenants/{tenant_id}/resend-domain", response_model=schemas.TenantOut)
async def provision_resend_domain(
    _: SuperAdminUser, db: DB, tenant_id: uuid.UUID, data: schemas.ProvisionDomainRequest
):
    """Register a custom sending domain in Resend for this tenant."""
    try:
        return await service.provision_resend_domain(db, tenant_id, data.domain)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Resend API error: {e}")


@router.post("/tenants/{tenant_id}/resend-domain/verify", response_model=schemas.TenantOut)
async def verify_resend_domain(_: SuperAdminUser, db: DB, tenant_id: uuid.UUID):
    """Trigger DNS re-check for the tenant's Resend domain and refresh its status."""
    try:
        return await service.verify_resend_domain(db, tenant_id)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Resend API error: {e}")


@router.get("/unsubscribe/{token}")
async def unsubscribe(token: str, db: DB):
    """Public — a contact clicks this from a broadcast email to opt out. No auth."""
    await service.opt_out_contact(db, token)
    # Always report success to avoid leaking whether a token maps to a contact.
    return {"unsubscribed": True}


@router.get("/resend-check")
async def resend_check(_: SuperAdminUser):
    """Diagnostic: shows exactly what the Resend receiving API returns for the most recent email."""
    settings = get_settings()
    if not settings.resend_api_key:
        return {"error": "RESEND_API_KEY not set"}

    auth = {"Authorization": f"Bearer {settings.resend_api_key}"}
    result: dict = {}

    async with httpx.AsyncClient(timeout=15) as client:
        list_resp = await client.get(
            "https://api.resend.com/emails/receiving",
            headers=auth,
            params={"limit": 3},
        )
        result["list_status"] = list_resp.status_code
        result["list_body"] = list_resp.json() if list_resp.status_code == 200 else list_resp.text

        if list_resp.status_code == 200:
            emails = list_resp.json().get("data", [])
            if emails:
                first_id = emails[0]["id"]
                body_resp = await client.get(
                    f"https://api.resend.com/emails/receiving/{first_id}",
                    headers=auth,
                )
                result["detail_status"] = body_resp.status_code
                result["detail_body"] = body_resp.json() if body_resp.status_code == 200 else body_resp.text
            else:
                result["detail_body"] = "no emails in list"

    return result


@router.get("/evolution-check")
async def evolution_check(_: SuperAdminUser, db: DB):
    """Diagnostic: probes the Evolution API — reachability, instances, connection states, and webhook config."""
    settings = get_settings()
    result: dict = {
        "config": {
            "EVOLUTION_API_URL": settings.evolution_api_url or None,
            "EVOLUTION_API_TOKEN_set": bool(settings.evolution_api_token),
            "effective_base_url": settings.effective_base_url or None,
        }
    }

    if not settings.evolution_api_url:
        result["error"] = "EVOLUTION_API_URL not set"
        return result

    base = settings.evolution_api_url.rstrip("/")
    headers = {"apikey": settings.evolution_api_token}

    tenant_rows = await db.execute(sa_select(Tenant.slug, Tenant.id))
    tenants = [(slug, str(tid)) for slug, tid in tenant_rows.all()]
    result["tenants_in_db"] = [{"slug": s, "id": i} for s, i in tenants]

    async with httpx.AsyncClient(timeout=10) as client:
        # 0. Version probe
        try:
            ver_resp = await client.get(base, headers=headers)
            ct = ver_resp.headers.get("content-type", "")
            result["version_probe"] = ver_resp.json() if "application/json" in ct else ver_resp.text[:300]
        except Exception as exc:
            result["version_probe_error"] = f"{type(exc).__name__}: {exc}"

        # 1. Fetch all instances from Evolution
        try:
            instances_resp = await client.get(f"{base}/instance/fetchInstances", headers=headers)
            result["fetch_instances_status"] = instances_resp.status_code
            if instances_resp.status_code == 200:
                result["fetch_instances_body"] = instances_resp.json()
            else:
                result["fetch_instances_body"] = instances_resp.text
        except Exception as exc:
            result["fetch_instances_error"] = f"{type(exc).__name__}: {exc}"
            return result

        # 2. Per-tenant: connection state + webhook config + LID contact lookup
        from app.modules.chat.models import ChatSession
        from sqlalchemy import select as _select

        per_tenant = []
        for slug, tenant_id in tenants:
            entry: dict = {"slug": slug, "tenant_id": tenant_id}

            try:
                state_resp = await client.get(
                    f"{base}/instance/connectionState/{slug}", headers=headers
                )
                entry["connection_state_status"] = state_resp.status_code
                if state_resp.status_code == 200:
                    data = state_resp.json()
                    entry["connection_state"] = (
                        data.get("instance", {}).get("state") or data.get("state") or data
                    )
                else:
                    entry["connection_state"] = state_resp.text
            except Exception as exc:
                entry["connection_state_error"] = f"{type(exc).__name__}: {exc}"

            try:
                wh_resp = await client.get(f"{base}/webhook/find/{slug}", headers=headers)
                entry["webhook_status"] = wh_resp.status_code
                entry["webhook_body"] = wh_resp.json() if wh_resp.status_code == 200 else wh_resp.text
            except Exception as exc:
                entry["webhook_error"] = f"{type(exc).__name__}: {exc}"

            # Check for any @lid phones in open sessions — these can't be replied to
            # unless Evolution supports @lid sends. Look up their contact in Evolution.
            try:
                lid_rows = await db.execute(
                    _select(ChatSession.whatsapp_phone, ChatSession.visitor_name).where(
                        ChatSession.tenant_id == uuid.UUID(tenant_id),
                        ChatSession.whatsapp_phone.like("%@lid"),
                        ChatSession.is_open == True,  # noqa: E712
                    ).limit(5)
                )
                lid_sessions = [{"phone": p, "name": n} for p, n in lid_rows.all()]
                entry["lid_sessions"] = lid_sessions

                if lid_sessions:
                    sample_lid = lid_sessions[0]["phone"]
                    # Try to find the real phone via Evolution's contact fetch
                    try:
                        contacts_resp = await client.post(
                            f"{base}/contact/fetchContacts/{slug}",
                            headers={"Content-Type": "application/json", **headers},
                            json={"where": {}},
                        )
                        entry["fetchContacts_status"] = contacts_resp.status_code
                        if contacts_resp.status_code == 200:
                            contacts = contacts_resp.json()
                            # Filter to the LID contact only
                            matching = [c for c in (contacts if isinstance(contacts, list) else contacts.get("contacts", []))
                                        if sample_lid.split("@")[0] in str(c.get("id", "")) or
                                           sample_lid.split("@")[0] in str(c.get("remoteJid", "")) or
                                           sample_lid.split("@")[0] in str(c.get("lid", ""))]
                            entry["fetchContacts_lid_match"] = matching[:3]
                        else:
                            entry["fetchContacts_body"] = contacts_resp.text[:300]
                    except Exception as exc:
                        entry["fetchContacts_error"] = f"{type(exc).__name__}: {exc}"

            except Exception as exc:
                entry["lid_check_error"] = f"{type(exc).__name__}: {exc}"

            per_tenant.append(entry)

        result["per_tenant"] = per_tenant

    return result


class EvolutionSendTestBody(BaseModel):
    number: str
    message: str = "test"
    instance: str = "default"


@router.post("/evolution-send-test")
async def evolution_send_test(_: SuperAdminUser, body: EvolutionSendTestBody):
    """Diagnostic: make a raw sendText call to Evolution API and return the full response."""
    settings = get_settings()
    if not settings.evolution_api_url:
        return {"error": "EVOLUTION_API_URL not set"}

    if not re.fullmatch(r"[a-zA-Z0-9_-]+", body.instance):
        raise HTTPException(status_code=400, detail="invalid instance name")

    base = settings.evolution_api_url.rstrip("/")
    headers = {"Content-Type": "application/json", "apikey": settings.evolution_api_token}

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{base}/message/sendText/{body.instance}",
            headers=headers,
            json={"number": body.number, "text": body.message},
        )
        ct = resp.headers.get("content-type", "")
        resp_body = resp.json() if "application/json" in ct else resp.text
        return {
            "request": {"number": body.number, "instance": body.instance},
            "status": resp.status_code,
            "body": resp_body,
        }
