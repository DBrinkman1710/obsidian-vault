from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, WebSocket, WebSocketDisconnect, status
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import CurrentUser
from app.config import get_settings
from app.core.models import Tenant, User
from app.core.tenant import resolve_tenant_by_slug
from app.database import db_session, get_db, set_tenant_context
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


@router.get("/sessions/count")
async def count_open_sessions(current_user: CurrentUser, db: DB):
    count = await db.scalar(
        select(func.count(ChatSession.id)).where(
            ChatSession.tenant_id == current_user.tenant_id,
            ChatSession.is_open == True,  # noqa: E712
        )
    )
    return {"open": count or 0}


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
        tenant = await db.get(Tenant, current_user.tenant_id)
        if tenant and tenant.whatsapp_phone_number_id and tenant.whatsapp_access_token:
            try:
                await whatsapp_service.send_whatsapp_message(
                    phone=session.whatsapp_phone,
                    body=text,
                    phone_number_id=tenant.whatsapp_phone_number_id,
                    access_token=tenant.whatsapp_access_token,
                )
            except Exception:
                # Log but don't fail — message is already saved in DB
                pass

    tenant_key = str(current_user.tenant_id)
    event_data = {
        "event": "message",
        "session_id": str(session_id),
        "sender_type": "agent",
        "sender_id": str(current_user.id),
        "body": text,
        "created_at": msg.created_at.isoformat(),
    }
    # Push to visitor widget socket for this session and to all agent dashboards
    await manager.broadcast_to_session(tenant_key, str(session_id), event_data)
    await manager.broadcast_to_agents(tenant_key, event_data)

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

@router.get("/webhooks/{tenant_slug}/whatsapp")
async def whatsapp_verify(tenant_slug: str, request: Request, db: DB):
    """Meta webhook verification handshake (slug-scoped — use same URL as the POST endpoint)."""
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")

    try:
        tenant_id = await resolve_tenant_by_slug(db, tenant_slug)
    except Exception:
        raise HTTPException(status_code=403, detail="Verification failed")

    tenant = await db.get(Tenant, tenant_id)
    if mode == "subscribe" and token and tenant and token == tenant.whatsapp_verify_token:
        return Response(content=challenge, media_type="text/plain")
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/webhooks/{tenant_slug}/whatsapp", status_code=status.HTTP_200_OK)
async def whatsapp_incoming(tenant_slug: str, request: Request, db: DB):
    """Receive inbound WhatsApp messages from Meta Cloud API. One URL per client:
    https://{env}.getyippie.com/api/v1/chat/webhooks/{slug}/whatsapp"""
    try:
        payload = await request.json()
    except Exception:
        return {"status": "ignored"}

    if payload.get("object") != "whatsapp_business_account":
        return {"status": "ignored"}

    tenant_id = await resolve_tenant_by_slug(db, tenant_slug)
    await set_tenant_context(db, tenant_id)
    await whatsapp_service.handle_incoming_webhook(db, tenant_id, payload)
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# WebSocket endpoint (website widget live chat)
# ---------------------------------------------------------------------------

@router.websocket("/ws/{tenant_slug}/{session_id}")
async def chat_ws(websocket: WebSocket, tenant_slug: str, session_id: str):
    """
    WebSocket endpoint for the embeddable website chat widget.
    Visitors connect with: wss://host/api/v1/chat/ws/{tenant_slug}/{session_id}
    session_id is generated client-side on first connect, then reused.
    """
    # Resolve tenant by slug — rejects unknown slugs cleanly
    try:
        async with db_session() as db:
            tenant_id = await resolve_tenant_by_slug(db, tenant_slug)
    except Exception:
        await websocket.close(code=4004)
        return

    tenant_key = str(tenant_id)
    await manager.connect(websocket, tenant_key, session_id)

    async with db_session() as db:
        await set_tenant_context(db, tenant_id)
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
            await manager.broadcast_to_agents(
                tenant_key,
                {"event": "new_session", "session_id": session_id},
            )

    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            msg_body = data.get("body", "").strip()

            if not msg_body:
                continue

            async with db_session() as db:
                await set_tenant_context(db, tenant_id)
                msg = ChatMessage(
                    tenant_id=session.tenant_id,
                    session_id=session.id,
                    sender_type="visitor",
                    sender_id=session_id,
                    body=msg_body,
                )
                db.add(msg)
                await db.commit()

            visitor_event = {
                "event": "message",
                "session_id": session_id,
                "sender_type": "visitor",
                "sender_id": session_id,
                "body": msg_body,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await manager.broadcast_to_session(tenant_key, session_id, visitor_event)
            await manager.broadcast_to_agents(tenant_key, visitor_event)
    except WebSocketDisconnect:
        manager.disconnect(websocket, tenant_key, session_id)
    except Exception:
        manager.disconnect(websocket, tenant_key, session_id)


# ---------------------------------------------------------------------------
# Agent WebSocket — authenticated; receives all tenant events in real time
# ---------------------------------------------------------------------------

@router.websocket("/ws/agent")
async def agent_ws(websocket: WebSocket, token: str):
    """Authenticated WebSocket for agent dashboards.

    Connect with: wss://host/api/v1/chat/ws/agent?token={access_token}
    Pushes 'message' and 'new_session' events for all sessions in the tenant.
    """
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id: str | None = payload.get("sub")
        if not user_id:
            raise ValueError("missing sub")
    except (JWTError, ValueError):
        await websocket.close(code=4001)
        return

    async with db_session() as db:
        user = await db.get(User, uuid.UUID(user_id))
        if not user or not user.is_active:
            await websocket.close(code=4001)
            return
        tenant_key = str(user.tenant_id)

    await manager.connect_agent(websocket, tenant_key)
    try:
        while True:
            await websocket.receive_text()  # keepalive pings — payload ignored
    except WebSocketDisconnect:
        manager.disconnect_agent(websocket, tenant_key)
    except Exception:
        manager.disconnect_agent(websocket, tenant_key)
