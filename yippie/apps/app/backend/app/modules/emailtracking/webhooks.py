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
        if settings.environment in ("development", "local", "test"):
            return True
        return False
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
            await db.commit()
        except Exception:
            log.exception("Failed to handle Resend event %s for %s", event_type, resend_id)
    return Response(status_code=200)
