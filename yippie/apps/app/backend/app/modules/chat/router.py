from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import CurrentUser
from app.config import load_tenant_config
from app.core.tenant import resolve_tenant_by_slug, resolve_tenant_uuid
from app.database import db_session, get_db
from app.modules.chat import whatsapp_service
from app.modules.chat.manager import manager
from app.modules.chat.models import ChatMessage, ChatSession

router = APIRouter(prefix="/chat", tags=["chat"])
DB = Annotated[AsyncSession, Depends(get_db)]


# ---------------------------------------------------------------------------
# REST endpoints (authenticated)
# ---------------------------------------------------------------------------

@router.get("/sessions")
async def list_sessions(current_user: CurrentUser, db: DB):
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.tenant_id == current_user.tenant_id)
        .order_by(ChatSession.started_at.desc())
        .limit(100)
    )
    sessions = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "source": s.source,
            "visitor_id": s.visitor_id,
            "visitor_name": s.visitor_name,
            "visitor_email": s.visitor_email,
            "whatsapp_phone": s.whatsapp_phone,
            "is_open": s.is_open,
            "started_at": s.started_at.isoformat(),
            "ended_at": s.ended_at.isoformat() if s.ended_at else None,
        }
        for s in sessions
    ]


@router.get("/sessions/{session_id}/messages")
async def get_messages(session_id: uuid.UUID, current_user: CurrentUser, db: DB):
    # Verify session belongs to tenant
    sess_result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.tenant_id == current_user.tenant_id,
        )
    )
    if not sess_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Session not found")

    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
    )
    msgs = result.scalars().all()
    return [
        {
            "id": str(m.id),
            "sender_type": m.sender_type,
            "sender_id": m.sender_id,
            "body": m.body,
            "created_at": m.created_at.isoformat(),
        }
        for m in msgs
    ]


class ReplyBody(BaseModel):
    body: str


@router.post("/sessions/{session_id}/reply", status_code=status.HTTP_201_CREATED)
async def reply_to_session(
    session_id: uuid.UUID,
    payload: ReplyBody,
    current_user: CurrentUser,
    db: DB,
):
    sess_result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.tenant_id == current_user.tenant_id,
        )
    )
    session = sess_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if not session.is_open:
        raise HTTPException(status_code=409, detail="Session is closed")

    text = payload.body.strip()
    if not text:
        raise HTTPException(status_code=400, detail="body must not be empty")

    msg = ChatMessage(
        tenant_id=current_user.tenant_id,
        session_id=session.id,
        sender_type="agent",
        sender_id=str(current_user.id),
        body=text,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    # Dispatch via WhatsApp if this session came from WhatsApp
    if session.source == "whatsapp" and session.whatsapp_phone:
        cfg = load_tenant_config()
        wa = cfg.whatsapp
        if wa.phone_number_id and wa.access_token:
            try:
                await whatsapp_service.send_whatsapp_message(
                    phone=session.whatsapp_phone,
                    body=text,
                    phone_number_id=wa.phone_number_id,
                    access_token=wa.access_token,
                )
            except Exception:
                # Log but don't fail — message is already saved in DB
                pass

    # Also push to any connected WebSocket agents viewing this session
    cfg = load_tenant_config()
    await manager.broadcast_to_session(
        cfg.tenant_id,
        str(session_id),
        {
            "event": "message",
            "session_id": str(session_id),
            "sender_type": "agent",
            "sender_id": str(current_user.id),
            "body": text,
            "created_at": msg.created_at.isoformat(),
        },
    )

    return {"id": str(msg.id), "body": msg.body, "created_at": msg.created_at.isoformat()}


@router.post("/sessions/{session_id}/close", status_code=status.HTTP_200_OK)
async def close_session(session_id: uuid.UUID, current_user: CurrentUser, db: DB):
    sess_result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.tenant_id == current_user.tenant_id,
        )
    )
    session = sess_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.is_open = False
    session.ended_at = datetime.now(timezone.utc)
    await db.commit()
    return {"status": "closed"}


# ---------------------------------------------------------------------------
# Meta Cloud API webhook endpoints (no auth — called by Meta)
# ---------------------------------------------------------------------------

@router.get("/webhooks/whatsapp")
async def whatsapp_verify(request: Request):
    """Meta webhook verification handshake."""
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")

    cfg = load_tenant_config()
    if mode == "subscribe" and token and token == cfg.whatsapp.verify_token:
        return Response(content=challenge, media_type="text/plain")
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/webhooks/whatsapp", status_code=status.HTTP_200_OK)
async def whatsapp_incoming(request: Request, db: DB):
    """Receive inbound WhatsApp messages from Meta Cloud API."""
    try:
        payload = await request.json()
    except Exception:
        return {"status": "ignored"}

    if payload.get("object") != "whatsapp_business_account":
        return {"status": "ignored"}

    tenant_id = await resolve_tenant_uuid(db)
    await whatsapp_service.handle_incoming_webhook(db, tenant_id, payload)
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# WebSocket endpoint (website widget live chat)
# ---------------------------------------------------------------------------

@router.websocket("/ws/{tenant_slug}/{session_id}")
async def chat_ws(websocket, tenant_slug: str, session_id: str):
    """
    WebSocket endpoint for the embeddable website chat widget.
    Visitors connect with: ws://host/api/v1/chat/ws/{tenant_slug}/{session_id}
    session_id is generated client-side on first connect, then reused.
    """
    from fastapi import WebSocket, WebSocketDisconnect

    tenant_cfg = load_tenant_config()
    if tenant_cfg.tenant_id != tenant_slug:
        await websocket.close(code=4004)
        return

    await manager.connect(websocket, tenant_slug, session_id)

    async with db_session() as db:
        tenant_id = await resolve_tenant_by_slug(db, tenant_slug)
        result = await db.execute(
            select(ChatSession).where(
                ChatSession.visitor_id == session_id,
                ChatSession.tenant_id == tenant_id,
                ChatSession.source == "websocket",
            )
        )
        session = result.scalar_one_or_none()
        if not session:
            session = ChatSession(
                tenant_id=tenant_id,
                source="websocket",
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
                tenant_slug,
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
    except Exception:
        manager.disconnect(websocket, tenant_slug, session_id)
