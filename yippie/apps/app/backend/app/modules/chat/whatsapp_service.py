from __future__ import annotations

import logging
import uuid

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.modules.chat.models import ChatMessage, ChatSession

logger = logging.getLogger(__name__)


def normalize_phone(phone: str) -> str:
    """Canonicalize a phone number to digits only.

    Evolution API sends remoteJid without a leading + (e.g. "31612345678"),
    while contacts may store "+31612345678" or a local format like "0612345678".
    Both the inbound (webhook) and outbound (agent send / broadcast) paths must
    use this so a single open session matches in both directions.
    """
    return "".join(ch for ch in phone if ch.isdigit())


async def find_open_session_for_phone(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    phone: str,
    canonicalize: bool = False,
) -> ChatSession | None:
    """Find the single open WhatsApp session for a phone number.

    Tries an exact match on canonical digits first, then falls back to an
    8-digit suffix match to bridge local-vs-international format mismatches
    (e.g. an inbound JID "31612345678" matching a session opened from a
    locally-formatted contact "0612345678").

    When canonicalize=True (inbound path only), a suffix match also updates the
    stored phone to the E.164 digits from the incoming remoteJid so future
    lookups hit the exact path. The outbound path (agent create/broadcast)
    passes canonicalize=False so it never overwrites an international-format
    phone with a local one — which would violate the open-session unique index
    and cause send+receive to land in separate sessions.
    """
    phone = normalize_phone(phone)
    if not phone:
        return None

    result = await db.execute(
        select(ChatSession).where(
            ChatSession.tenant_id == tenant_id,
            ChatSession.whatsapp_phone == phone,
            ChatSession.is_open == True,  # noqa: E712
        )
    )
    session = result.scalar_one_or_none()
    if session:
        return session

    # Fallback: suffix match for local-vs-international mismatch.
    # Compare the last 8 digits — unique enough for mobile numbers within one tenant.
    if len(phone) >= 8:
        suffix = phone[-8:]
        fb = await db.execute(
            select(ChatSession).where(
                ChatSession.tenant_id == tenant_id,
                ChatSession.source == "whatsapp",
                ChatSession.whatsapp_phone.like(f"%{suffix}"),
                ChatSession.is_open == True,  # noqa: E712
            ).limit(1)
        )
        session = fb.scalar_one_or_none()
        if session and canonicalize and session.whatsapp_phone != phone:
            session.whatsapp_phone = phone
            session.visitor_id = phone
    return session


def _headers() -> dict:
    settings = get_settings()
    return {"apikey": settings.evolution_api_token}


def _base_url() -> str:
    url = get_settings().evolution_api_url
    if not url:
        raise RuntimeError("EVOLUTION_API_URL is not configured")
    return url.rstrip("/")


async def _register_webhook(client: httpx.AsyncClient, instance_name: str) -> None:
    """Tell Evolution API where to POST incoming messages for this instance."""
    settings = get_settings()
    base_url = settings.effective_base_url
    if not base_url:
        logger.warning("effective_base_url is empty — skipping webhook registration for '%s'", instance_name)
        return
    webhook_url = f"{base_url}/api/v1/chat/webhooks/{instance_name}/whatsapp"
    # Evolution API v2 payload: nested under "webhook", byEvents=false so all
    # events POST to a single URL, event names in UPPER_SNAKE_CASE.
    resp = await client.post(
        f"{_base_url()}/webhook/set/{instance_name}",
        headers={"Content-Type": "application/json", **_headers()},
        json={
            "webhook": {
                "enabled": True,
                "url": webhook_url,
                "byEvents": False,
                "events": ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE"],
            }
        },
    )
    if not resp.is_success:
        logger.error("Failed to register webhook for '%s': %s %s", instance_name, resp.status_code, resp.text)
    else:
        logger.info("Webhook registered for '%s' → %s", instance_name, webhook_url)


async def _ensure_instance(client: httpx.AsyncClient, instance_name: str) -> None:
    """Create the Evolution API instance for this tenant slug if it doesn't exist."""
    base = _base_url()
    resp = await client.get(
        f"{base}/instance/connectionState/{instance_name}",
        headers=_headers(),
    )
    if resp.status_code == 404:
        logger.info("Evolution API instance '%s' not found — creating it", instance_name)
        create_resp = await client.post(
            f"{base}/instance/create",
            headers={"Content-Type": "application/json", **_headers()},
            json={"instanceName": instance_name, "qrcode": True, "integration": "WHATSAPP-BAILEYS"},
        )
        if create_resp.status_code not in (200, 201):
            logger.error(
                "Failed to create Evolution API instance '%s': %s %s",
                instance_name,
                create_resp.status_code,
                create_resp.text,
            )
            create_resp.raise_for_status()
        logger.info("Evolution API instance '%s' created", instance_name)
        await _register_webhook(client, instance_name)
    else:
        # Re-register on every QR fetch in case the URL changed (e.g. env switch)
        await _register_webhook(client, instance_name)


async def get_connection_state(instance_name: str) -> str:
    base = _base_url()
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f"{base}/instance/connectionState/{instance_name}",
            headers=_headers(),
        )
        resp.raise_for_status()
        data = resp.json()
        # Evolution API typically nests the state under "instance": {"state": "..."}
        if isinstance(data, dict):
            if "instance" in data and isinstance(data["instance"], dict):
                return data["instance"].get("state", "")
            return data.get("state", "")
        return ""


async def disconnect_instance(instance_name: str) -> bool:
    """Log out the WhatsApp session on this Evolution API instance.

    Returns True if the logout was confirmed, False if the instance was not
    found or already disconnected (both are treated as success for a reset flow).
    Raises on unexpected HTTP errors.
    """
    base = _base_url()
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.delete(
            f"{base}/instance/logout/{instance_name}",
            headers=_headers(),
        )
        if resp.status_code == 404:
            return False
        resp.raise_for_status()
        return True


async def get_pairing_qr(instance_name: str) -> dict:
    base = _base_url()
    async with httpx.AsyncClient(timeout=15) as client:
        await _ensure_instance(client, instance_name)
        resp = await client.get(
            f"{base}/instance/connect/{instance_name}",
            headers=_headers(),
        )
        if not resp.is_success:
            logger.error(
                "Evolution API /instance/connect/%s returned %s: %s",
                instance_name,
                resp.status_code,
                resp.text,
            )
        resp.raise_for_status()
        return resp.json()


async def send_media(
    instance_name: str,
    number: str,
    media_base64: str,
    media_type: str,
    filename: str,
    caption: str | None = None,
) -> dict | None:
    """Send an image or document via Evolution API.

    media_type: "image" | "document" (used as Evolution API mediatype)
    media_base64: raw base64 string (no data URI prefix)
    Returns the Evolution API response JSON or None on failure.
    """
    settings = get_settings()
    normalized = "".join(ch for ch in number if ch.isdigit())
    payload: dict = {
        "number": normalized,
        "mediatype": media_type,
        "media": media_base64,
        "delay": 1200,
    }
    if caption:
        payload["caption"] = caption
    if media_type == "document":
        payload["fileName"] = filename

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{settings.evolution_api_url}/message/sendMedia/{instance_name}",
            headers={"Content-Type": "application/json", "apikey": settings.evolution_api_token},
            json=payload,
        )
        if not resp.is_success:
            logger.error(
                "Evolution sendMedia %s -> %s %s: %s",
                instance_name,
                normalized,
                resp.status_code,
                resp.text,
            )
        resp.raise_for_status()
        return resp.json()


async def send_text(instance_name: str, number: str, text: str) -> dict | None:
    settings = get_settings()
    # Normalize to bare digits (E.164 without leading +) as required by Evolution API
    normalized = "".join(ch for ch in number if ch.isdigit())
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            f"{settings.evolution_api_url}/message/sendText/{instance_name}",
            headers={"Content-Type": "application/json", "apikey": settings.evolution_api_token},
            json={
                "number": normalized,
                "text": text,
                "delay": 1200,
                "linkPreview": True,
            },
        )
        if not resp.is_success:
            logger.error(
                "Evolution sendText %s -> %s %s: %s",
                instance_name,
                normalized,
                resp.status_code,
                resp.text,
            )
        resp.raise_for_status()
        return resp.json()


async def handle_incoming_webhook(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    payload: dict,
) -> dict | None:
    """Returns event dict for broadcasting, or None if the message was ignored."""
    logger.info("Evolution webhook received: event=%s", payload.get("event"))
    if payload.get("event") not in ("messages.upsert", "MESSAGES_UPSERT"):
        return None

    data = payload.get("data", {})
    key = data.get("key", {})

    if key.get("fromMe"):
        return None

    remote_jid: str = key.get("remoteJid", "")
    # Normalize to digits only — matches the format stored via _find_or_create_open_session
    phone = normalize_phone(remote_jid.split("@")[0]) if remote_jid else ""
    if not phone:
        return None

    message = data.get("message", {})
    text = message.get("conversation") or message.get("extendedTextMessage", {}).get("text", "")
    if not text:
        return None

    visitor_name: str | None = data.get("pushName") or None

    # Find the single open session for this phone (exact, then suffix fallback).
    # canonicalize=True so a suffix match also updates the stored phone to the
    # E.164 remoteJid digits — keeping the session findable by future inbound messages.
    session = await find_open_session_for_phone(db, tenant_id, phone, canonicalize=True)

    is_new_session = False
    if not session:
        session = ChatSession(
            tenant_id=tenant_id,
            source="whatsapp",
            visitor_id=phone,
            visitor_name=visitor_name,
            whatsapp_phone=phone,
            is_open=True,
        )
        db.add(session)
        await db.flush()
        is_new_session = True
    else:
        if visitor_name and not session.visitor_name:
            session.visitor_name = visitor_name

    session.unread_count = (session.unread_count or 0) + 1

    msg = ChatMessage(
        tenant_id=tenant_id,
        session_id=session.id,
        sender_type="visitor",
        sender_id=phone,
        body=text,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    return {
        "session_id": str(session.id),
        "visitor_id": session.visitor_id,
        "body": text,
        "created_at": msg.created_at.isoformat(),
        "unread_count": session.unread_count,
        "is_new_session": is_new_session,
        "assigned_to": str(session.assigned_to) if session.assigned_to else None,
    }
