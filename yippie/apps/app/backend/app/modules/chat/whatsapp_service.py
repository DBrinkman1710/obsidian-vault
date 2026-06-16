from __future__ import annotations

import uuid

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.modules.chat.models import ChatMessage, ChatSession


def _headers() -> dict:
    settings = get_settings()
    return {"apikey": settings.evolution_api_token}


async def get_connection_state(instance_name: str) -> str:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f"{settings.evolution_api_url}/instance/connectionState/{instance_name}",
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


async def send_text(instance_name: str, number: str, text: str) -> None:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            f"{settings.evolution_api_url}/message/sendText/{instance_name}",
            headers={"Content-Type": "application/json", "apikey": settings.evolution_api_token},
            json={
                "number": number,
                "options": {"delay": 1200, "presence": "composing", "linkPreview": True},
                "textMessage": {"text": text},
            },
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
