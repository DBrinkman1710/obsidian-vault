from __future__ import annotations

import uuid

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.chat.models import ChatMessage, ChatSession

META_API_VERSION = "v19.0"
META_GRAPH_URL = f"https://graph.facebook.com/{META_API_VERSION}"


async def send_whatsapp_message(
    phone: str,
    body: str,
    phone_number_id: str,
    access_token: str,
) -> None:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            f"{META_GRAPH_URL}/{phone_number_id}/messages",
            headers={"Authorization": f"Bearer {access_token}"},
            json={
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": phone,
                "type": "text",
                "text": {"body": body},
            },
        )
        resp.raise_for_status()


async def handle_incoming_webhook(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    payload: dict,
) -> None:
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            if change.get("field") != "messages":
                continue

            # Build a lookup of wa_id → profile name from contacts array
            profile_names: dict[str, str] = {
                c["wa_id"]: c.get("profile", {}).get("name", "")
                for c in value.get("contacts", [])
            }

            for msg in value.get("messages", []):
                if msg.get("type") != "text":
                    continue

                phone: str = msg["from"]
                text: str = msg.get("text", {}).get("body", "")
                visitor_name: str | None = profile_names.get(phone) or None

                # Find the open session for this phone, or create one
                result = await db.execute(
                    select(ChatSession).where(
                        ChatSession.tenant_id == tenant_id,
                        ChatSession.whatsapp_phone == phone,
                        ChatSession.is_open == True,
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

                db.add(ChatMessage(
                    tenant_id=tenant_id,
                    session_id=session.id,
                    sender_type="visitor",
                    sender_id=phone,
                    body=text,
                ))

    await db.commit()
