from __future__ import annotations

import logging
import uuid

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.modules.chat.models import ChatMessage, ChatSession

logger = logging.getLogger(__name__)


def _headers() -> dict:
    settings = get_settings()
    return {"apikey": settings.evolution_api_token}


def _base_url() -> str:
    url = get_settings().evolution_api_url
    if not url:
        raise RuntimeError("EVOLUTION_API_URL is not configured")
    return url.rstrip("/")


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


async def send_text(instance_name: str, number: str, text: str) -> None:
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


async def handle_incoming_webhook(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    payload: dict,
) -> None:
    if payload.get("event") != "messages.upsert":
        return

    data = payload.get("data", {})
    key = data.get("key", {})

    if key.get("fromMe"):
        return

    remote_jid: str = key.get("remoteJid", "")
    phone = remote_jid.split("@")[0] if remote_jid else ""
    if not phone:
        return

    message = data.get("message", {})
    text = message.get("conversation") or message.get("extendedTextMessage", {}).get("text", "")
    if not text:
        return

    visitor_name: str | None = data.get("pushName") or None

    # Find the open session for this phone, or create one
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.tenant_id == tenant_id,
            ChatSession.whatsapp_phone == phone,
            ChatSession.is_open == True,  # noqa: E712
        )
    )
    session = result.scalar_one_or_none()

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
    elif visitor_name and not session.visitor_name:
        session.visitor_name = visitor_name

    session.unread_count = (session.unread_count or 0) + 1

    db.add(ChatMessage(
        tenant_id=tenant_id,
        session_id=session.id,
        sender_type="visitor",
        sender_id=phone,
        body=text,
    ))

    await db.commit()
