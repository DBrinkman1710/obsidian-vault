from __future__ import annotations
import hashlib
import hmac
import logging
from datetime import datetime, timezone
from typing import Annotated, Any
from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import get_settings
from app.database import get_db
from app.modules.emailtracking import service

log = logging.getLogger(__name__)
webhook_router = APIRouter(prefix="/emailtracking", tags=["emailtracking-webhooks"])
DB = Annotated[AsyncSession, Depends(get_db)]

def _verify_signature(
    body: bytes,
    svix_id: str | None,
    svix_timestamp: str | None,
    svix_signature: str | None,
) -> bool:
    import base64
    settings = get_settings()
    secret = settings.resend_webhook_secret
    if not secret:
        # Only skip verification in local/dev/test; in any deployed environment a
        # missing secret must hard-fail rather than accept unsigned webhooks.
        # is_development() treats an unset ENVIRONMENT as deployed — the field
        # defaults to "development", so a plain string comparison here would
        # accept unsigned webhooks on a service that is merely misconfigured.
        from app.config import is_development

        return is_development(settings)
    if not svix_id or not svix_timestamp or not svix_signature:
        return False
    try:
        raw_secret = base64.b64decode(secret.removeprefix("whsec_"))
    except Exception:
        return False
    # Svix signs "{svix_id}.{svix_timestamp}.{body}" with the base64-decoded secret.
    signed = svix_id.encode() + b"." + svix_timestamp.encode() + b"." + body
    expected = base64.b64encode(hmac.new(raw_secret, signed, hashlib.sha256).digest()).decode()
    for part in svix_signature.split(" "):
        if part.startswith("v1,") and hmac.compare_digest(expected, part[3:]):
            return True
    return False

@webhook_router.post("/webhooks/resend", include_in_schema=False)
async def resend_webhook(request: Request, db: DB):
    body = await request.body()
    svix_id = request.headers.get("svix-id")
    svix_timestamp = request.headers.get("svix-timestamp")
    svix_sig = request.headers.get("svix-signature")
    if not _verify_signature(body, svix_id, svix_timestamp, svix_sig):
        return Response(status_code=403, content="Invalid signature")
    try:
        payload: dict[str, Any] = await request.json()
    except Exception:
        return Response(status_code=200)

    event_type = payload.get("type", "")
    data = payload.get("data", {})
    resend_id = data.get("email_id") or data.get("id", "")
    created_str = data.get("created_at")
    event_time: datetime | None = None
    if created_str:
        try:
            event_time = datetime.fromisoformat(created_str.replace("Z", "+00:00"))
        except Exception:
            event_time = datetime.now(timezone.utc)

    if resend_id and event_type in ("email.delivered", "email.opened", "email.clicked", "email.bounced"):
        try:
            await service.handle_event(db, resend_id, event_type, event_time)
            if event_type == "email.bounced":
                await _handle_bounce(db, resend_id, data)
            await db.commit()
        except Exception:
            log.exception("Failed to handle Resend event %s for %s", event_type, resend_id)
    elif event_type in ("email.received", "email.inbound", "inbound"):
        # MKTG1 — an inbound reply: match the sender to a campaign recipient,
        # classify the reply, mark it 'replied', and auto-unsubscribe opt-outs.
        try:
            await _handle_inbound_reply(db, data)
            await db.commit()
        except Exception:
            await db.rollback()
            log.exception("Failed to handle inbound reply")
    return Response(status_code=200)


async def _handle_bounce(db: AsyncSession, resend_id: str, data: dict[str, Any]) -> None:
    """Record a contact_bounces row when Resend reports a bounce."""
    from sqlalchemy import select as _select
    from app.modules.emailtracking.models import OutboundEmail
    from app.modules.contacts.models import Contact as _Contact
    from app.modules.marketing.service import record_bounce

    outbound = await service.get_by_resend_id(db, resend_id)
    if outbound is None:
        return
    tenant_id = outbound.tenant_id
    to_email = outbound.to_email
    if not tenant_id or not to_email:
        return

    contact_q = await db.execute(
        _select(_Contact)
        .where(
            _Contact.tenant_id == tenant_id,
            _Contact.email == to_email,
            _Contact.deleted_at.is_(None),
        )
        .order_by(_Contact.created_at.asc())
        .limit(1)
    )
    # Email is not unique per tenant — take the oldest match deterministically
    # instead of assuming a single row (scalar_one_or_none raises on duplicates).
    contact = contact_q.scalars().first()
    bounce_type = data.get("bounce", {}).get("type", "hard") if isinstance(data.get("bounce"), dict) else "hard"
    await record_bounce(
        db,
        tenant_id=tenant_id,
        contact_id=contact.id if contact else None,
        bounce_type=bounce_type,
    )
    # [FLOW7] campaign email bounced — the resend_webhook caller commits.
    from app.core.flow_events import emit_flow_event

    await emit_flow_event(
        db, tenant_id, "campaign_email_bounced",
        entity_type="email", entity_id=outbound.id,
        contact_id=contact.id if contact else None,
        payload={
            "bounce_type": bounce_type,
            "to_email": to_email,
            "contact_id": contact.id if contact else None,
        },
    )


def _extract_sender(data: dict[str, Any]) -> str | None:
    """Pull the sender address out of a Resend inbound payload (best-effort)."""
    sender = data.get("from") or data.get("sender") or ""
    if isinstance(sender, dict):
        sender = sender.get("email") or sender.get("address") or ""
    if isinstance(sender, list) and sender:
        first = sender[0]
        sender = first.get("email") if isinstance(first, dict) else first
    if isinstance(sender, str) and "<" in sender:
        sender = sender.split("<", 1)[1].split(">", 1)[0]
    sender = (sender or "").strip().lower()
    return sender or None


async def _handle_inbound_reply(db: AsyncSession, data: dict[str, Any]) -> None:
    from app.core.tenant import resolve_tenant_by_inbound_email
    from app.database import set_tenant_context
    from app.modules.marketing.replies import handle_inbound_reply

    sender = _extract_sender(data)
    if not sender:
        return

    # Resolve the receiving tenant by the inbound address Resend forwarded to.
    to_addr = data.get("to") or data.get("recipient") or ""
    if isinstance(to_addr, list) and to_addr:
        to_addr = to_addr[0]
    if isinstance(to_addr, dict):
        to_addr = to_addr.get("email") or ""
    to_addr = (to_addr or "").strip().lower()
    tenant_id = await resolve_tenant_by_inbound_email(db, to_addr) if to_addr else None
    if tenant_id is None:
        return

    await set_tenant_context(db, str(tenant_id))
    body = data.get("text") or data.get("body-plain") or data.get("html") or ""
    if isinstance(body, dict):
        body = body.get("text") or body.get("html") or ""
    await handle_inbound_reply(db, tenant_id=tenant_id, sender_email=sender, body=str(body))
