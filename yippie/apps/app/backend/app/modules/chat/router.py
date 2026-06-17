from __future__ import annotations

import asyncio
import json
import random
import uuid
from datetime import datetime, timezone
from typing import Annotated, Optional

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect, status
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import CurrentUser
from app.config import get_settings
from app.core.models import Tenant, User
from app.core.tenant import resolve_tenant_by_slug
from app.database import db_session, get_db, set_tenant_context
from app.modules.booking import service as booking_service
from app.modules.booking.schemas import BookingTokenCreate
from app.modules.chat import whatsapp_service
from app.modules.chat.manager import manager
from app.modules.chat.models import ChatMessage, ChatSession
from app.modules.contacts.models import Contact

router = APIRouter(prefix="/chat", tags=["chat"])
DB = Annotated[AsyncSession, Depends(get_db)]

# Websocket endpoints live on their own router, mounted without the module-gating
# dependencies (require_module/require_feature) that main.py applies to `router`.
# Those gates depend on HTTPBearer, which only knows how to read an HTTP Request —
# wiring it into a websocket route crashes every connection with
# "HTTPBearer.__call__() missing 1 required positional argument: 'request'".
ws_router = APIRouter(prefix="/chat", tags=["chat"])


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
            "unread_count": s.unread_count,
            "started_at": s.started_at.isoformat(),
            "ended_at": s.ended_at.isoformat() if s.ended_at else None,
        }
        for s in sessions
    ]


def _session_dict(s: ChatSession) -> dict:
    return {
        "id": str(s.id),
        "source": s.source,
        "visitor_id": s.visitor_id,
        "visitor_name": s.visitor_name,
        "visitor_email": s.visitor_email,
        "whatsapp_phone": s.whatsapp_phone,
        "is_open": s.is_open,
        "unread_count": s.unread_count,
        "started_at": s.started_at.isoformat(),
        "ended_at": s.ended_at.isoformat() if s.ended_at else None,
    }


async def _find_or_create_open_session(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    phone: str,
    contact_id: Optional[uuid.UUID] = None,
    visitor_name: Optional[str] = None,
) -> ChatSession:
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
            contact_id=contact_id,
            is_open=True,
        )
        db.add(session)
        await db.flush()
    else:
        if contact_id and not session.contact_id:
            session.contact_id = contact_id
        if visitor_name and not session.visitor_name:
            session.visitor_name = visitor_name
    return session


class CreateSessionBody(BaseModel):
    phone: str
    contact_id: Optional[uuid.UUID] = None


@router.post("/sessions", status_code=status.HTTP_201_CREATED)
async def create_session(body: CreateSessionBody, current_user: CurrentUser, db: DB):
    visitor_name = None
    if body.contact_id:
        contact = await db.get(Contact, body.contact_id)
        if contact and contact.tenant_id == current_user.tenant_id:
            visitor_name = contact.full_name

    session = await _find_or_create_open_session(
        db, current_user.tenant_id, body.phone, body.contact_id, visitor_name
    )
    await db.commit()
    await db.refresh(session)
    return _session_dict(session)


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
        if tenant:
            try:
                await whatsapp_service.send_text(tenant.slug, session.whatsapp_phone, text)
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


@router.post("/sessions/{session_id}/read", status_code=status.HTTP_200_OK)
async def mark_session_read(session_id: uuid.UUID, current_user: CurrentUser, db: DB):
    sess_result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.tenant_id == current_user.tenant_id,
        )
    )
    session = sess_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.unread_count = 0
    await db.commit()

    tenant_key = str(current_user.tenant_id)
    await manager.broadcast_to_agents(
        tenant_key,
        {"event": "unread_update", "session_id": str(session_id), "unread_count": 0},
    )
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# WhatsApp pairing
# ---------------------------------------------------------------------------

@router.get("/whatsapp/qr")
async def get_whatsapp_qr(current_user: CurrentUser, db: DB):
    tenant = await db.get(Tenant, current_user.tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    try:
        data = await whatsapp_service.get_pairing_qr(tenant.slug)
    except (httpx.HTTPError, Exception):
        raise HTTPException(status_code=502, detail="Could not reach Evolution API or instance unavailable")

    return {
        "base64": data.get("base64"),
        "code": data.get("code"),
        "pairing_code": data.get("pairingCode"),
    }


@router.get("/whatsapp/status")
async def get_whatsapp_status(current_user: CurrentUser, db: DB):
    tenant = await db.get(Tenant, current_user.tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    try:
        state = await whatsapp_service.get_connection_state(tenant.slug)
    except Exception:
        return {"state": ""}

    return {"state": state or ""}


# ---------------------------------------------------------------------------
# Broadcast
# ---------------------------------------------------------------------------

@router.get("/broadcast/booking-link")
async def get_broadcast_booking_link(contact_id: uuid.UUID, current_user: CurrentUser, db: DB):
    try:
        token = await booking_service.create_booking_token(
            db,
            current_user.tenant_id,
            current_user.id,
            BookingTokenCreate(contact_id=contact_id, mode="open"),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    url = f"{booking_service.CLIENT_BASE_URL}/book/{token.id}"
    return {"url": url}


class BroadcastBody(BaseModel):
    contact_ids: list[uuid.UUID]
    message: str
    append_booking_link: bool = False


async def _run_broadcast(
    contact_ids: list[uuid.UUID],
    message: str,
    append_booking_link: bool,
    tenant_id: uuid.UUID,
    created_by_id: uuid.UUID,
) -> None:
    tenant_key = str(tenant_id)
    for idx, contact_id in enumerate(contact_ids):
        try:
            async with db_session() as db:
                await set_tenant_context(db, tenant_id)

                contact = await db.get(Contact, contact_id)
                if not contact or not contact.phone or contact.broadcast_opted_out:
                    continue

                tenant = await db.get(Tenant, tenant_id)
                if not tenant:
                    continue

                session = await _find_or_create_open_session(
                    db, tenant_id, contact.phone, contact_id, contact.full_name
                )

                text = message
                if append_booking_link:
                    try:
                        token = await booking_service.create_booking_token(
                            db,
                            tenant_id,
                            created_by_id,
                            BookingTokenCreate(contact_id=contact_id, mode="open"),
                        )
                        url = f"{booking_service.CLIENT_BASE_URL}/book/{token.id}"
                        text = f"{message}\n\n{url}"
                    except ValueError:
                        pass

                msg = ChatMessage(
                    tenant_id=tenant_id,
                    session_id=session.id,
                    sender_type="agent",
                    sender_id=str(created_by_id),
                    body=text,
                )
                db.add(msg)
                await db.commit()
                await db.refresh(msg)

                try:
                    await whatsapp_service.send_text(tenant.slug, contact.phone, text)
                except Exception:
                    pass

                event_data = {
                    "event": "message",
                    "session_id": str(session.id),
                    "sender_type": "agent",
                    "sender_id": str(created_by_id),
                    "body": text,
                    "created_at": msg.created_at.isoformat(),
                }
                await manager.broadcast_to_session(tenant_key, str(session.id), event_data)
                await manager.broadcast_to_agents(tenant_key, event_data)
        except Exception:
            # Never let one failed recipient stop the rest of the broadcast.
            pass

        if idx < len(contact_ids) - 1:
            await asyncio.sleep(random.uniform(5, 10))


@router.post("/broadcast", status_code=status.HTTP_202_ACCEPTED)
async def broadcast(
    body: BroadcastBody,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser,
    db: DB,
):
    tenant = await db.get(Tenant, current_user.tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    result = await db.execute(
        select(Contact.id).where(
            Contact.tenant_id == current_user.tenant_id,
            Contact.id.in_(body.contact_ids),
            Contact.phone.is_not(None),
            Contact.broadcast_opted_out == False,  # noqa: E712
        )
    )
    valid_ids = [r[0] for r in result.all()]
    if not valid_ids:
        raise HTTPException(status_code=400, detail="No eligible contacts to broadcast to")

    try:
        state = await whatsapp_service.get_connection_state(tenant.slug)
    except Exception:
        raise HTTPException(status_code=409, detail="WhatsApp is not connected")

    if state not in ("open", "connected"):
        raise HTTPException(status_code=409, detail="WhatsApp is not connected")

    background_tasks.add_task(
        _run_broadcast,
        valid_ids,
        body.message,
        body.append_booking_link,
        current_user.tenant_id,
        current_user.id,
    )
    return {"queued": len(valid_ids)}


# ---------------------------------------------------------------------------
# Evolution API webhook endpoint (no auth — called by Evolution)
# ---------------------------------------------------------------------------

@router.post("/webhooks/{tenant_slug}/whatsapp", status_code=status.HTTP_200_OK)
async def whatsapp_incoming(tenant_slug: str, request: Request, db: DB):
    """Receive inbound WhatsApp messages from Evolution API. One URL per client:
    https://{env}.getyippie.com/api/v1/chat/webhooks/{slug}/whatsapp"""
    try:
        payload = await request.json()
    except Exception:
        return {"status": "ignored"}

    tenant_id = await resolve_tenant_by_slug(db, tenant_slug)
    await set_tenant_context(db, tenant_id)
    await whatsapp_service.handle_incoming_webhook(db, tenant_id, payload)
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# WebSocket endpoint (website widget live chat)
# ---------------------------------------------------------------------------

@ws_router.websocket("/ws/{tenant_slug}/{session_id}")
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

@ws_router.websocket("/ws/agent")
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
