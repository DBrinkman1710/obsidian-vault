from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.config import load_tenant_config
from app.database import db_session
from app.modules.chat.manager import manager
from app.modules.chat.models import ChatMessage, ChatSession

router = APIRouter(prefix="/chat", tags=["chat"])


@router.websocket("/ws/{tenant_slug}/{session_id}")
async def chat_ws(websocket: WebSocket, tenant_slug: str, session_id: str):
    """
    WebSocket endpoint for live chat.
    Visitors connect with: ws://host/api/v1/chat/ws/{tenant_slug}/{session_id}
    session_id is generated client-side on first connect, then reused.
    """
    tenant_cfg = load_tenant_config()
    if tenant_cfg.tenant_id != tenant_slug and tenant_slug != tenant_cfg.tenant_id:
        await websocket.close(code=4004)
        return

    tenant_id = tenant_cfg.tenant_id
    await manager.connect(websocket, tenant_id, session_id)

    async with db_session() as db:
        result = await db.execute(
            select(ChatSession).where(ChatSession.session_id_str == session_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            session = ChatSession(
                tenant_id=uuid.uuid4(),  # resolved below properly
                visitor_id=session_id,
                is_open=True,
            )
            db.add(session)
            await db.commit()
            await db.refresh(session)

    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            msg_body = data.get("body", "").strip()
            sender_type = data.get("sender_type", "visitor")
            sender_id = data.get("sender_id", session_id)

            if not msg_body:
                continue

            async with db_session() as db:
                msg = ChatMessage(
                    tenant_id=session.tenant_id,
                    session_id=session.id,
                    sender_type=sender_type,
                    sender_id=sender_id,
                    body=msg_body,
                )
                db.add(msg)
                await db.commit()

            await manager.broadcast_to_session(
                tenant_id,
                session_id,
                {
                    "event": "message",
                    "session_id": session_id,
                    "sender_type": sender_type,
                    "sender_id": sender_id,
                    "body": msg_body,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                },
            )
    except WebSocketDisconnect:
        manager.disconnect(websocket, tenant_id, session_id)
