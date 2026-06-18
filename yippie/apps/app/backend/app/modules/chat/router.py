from __future__ import annotations

import asyncio
import json
import logging
import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect, status
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

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

# Public webhook router — no auth, Evolution API POSTs here
webhook_router = APIRouter(prefix="/chat", tags=["chat"])


# ---------------------------------------------------------------------------
# REST endpoints (authenticated)
# ---------------------------------------------------------------------------

def _session_dict(s: ChatSession, assignee_name: str | None = None) -> dict:
    return {
        "id": str(s.id),
        "source": s.source,
        "visitor_id": s.visitor_id,
        "visitor_name": s.visitor_name,
        "visitor_email": s.visitor_email,
        "whatsapp_phone": s.whatsapp_phone,
        "contact_id": str(s.contact_id) if s.contact_id else None,
        "ticket_id": str(s.ticket_id) if s.ticket_id else None,
        "status": s.status,
        "assigned_to": str(s.assigned_to) if s.assigned_to else None,
        "assigned_to_name": assignee_name,
        "solved_at": s.solved_at.isoformat() if s.solved_at else None,
        "is_open": s.is_open,
        "unread_count": s.unread_count,
        "started_at": s.started_at.isoformat(),
        "ended_at": s.ended_at.isoformat() if s.ended_at else None,
    }


@router.get("/sessions")
async def list_sessions(
    current_user: CurrentUser,
    db: DB,
    filter: str = "all",
    contact_id: Optional[uuid.UUID] = None,
    status_filter: Optional[str] = None,
):
    """List chat sessions.

    filter: "mine" (assigned to me) | "open" (unassigned & open) | "all" (default).
    Solved sessions auto-hide from the active list after the tenant's
    hide_solved_chats_hours window — messages are retained, this is display only.
    contact_id / status_filter: used by the contact chat-history panel.
    """
    stmt = select(ChatSession).where(ChatSession.tenant_id == current_user.tenant_id)

    if contact_id is not None:
        stmt = stmt.where(ChatSession.contact_id == contact_id)
    if status_filter is not None:
        stmt = stmt.where(ChatSession.status == status_filter)

    if contact_id is None and status_filter is None:
        if filter == "mine":
            stmt = stmt.where(ChatSession.assigned_to == current_user.id)
        elif filter == "open":
            stmt = stmt.where(ChatSession.status == "open")

        tenant = await db.get(Tenant, current_user.tenant_id)
        hours = tenant.hide_solved_chats_hours if tenant else 72
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        stmt = stmt.where(
            (ChatSession.status != "solved")
            | (ChatSession.solved_at.is_(None))
            | (ChatSession.solved_at >= cutoff)
        )

    result = await db.execute(stmt.order_by(ChatSession.started_at.desc()).limit(100))
    sessions = result.scalars().all()

    assignee_ids = {s.assigned_to for s in sessions if s.assigned_to}
    names: dict[uuid.UUID, str] = {}
    if assignee_ids:
        urows = await db.execute(select(User.id, User.full_name).where(User.id.in_(assignee_ids)))
        names = {uid: name for uid, name in urows.all()}

    return [_session_dict(s, names.get(s.assigned_to) if s.assigned_to else None) for s in sessions]


async def _find_or_create_open_session(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    phone: str,
    contact_id: Optional[uuid.UUID] = None,
    visitor_name: Optional[str] = None,
) -> ChatSession:
    # Normalize to digits only — Evolution API sends remoteJid without + (e.g. "31612345678")
    # while contacts may store "+31612345678". Keep them consistent so lookups always match.
    phone = "".join(ch for ch in phone if ch.isdigit())
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
            ChatSession.unread_count > 0,
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
            "msg_status": m.msg_status,
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
    if session.assigned_to and session.assigned_to != current_user.id:
        raise HTTPException(status_code=409, detail="Session is assigned to another agent")

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
                wa_response = await whatsapp_service.send_text(tenant.slug, session.whatsapp_phone, text)
                # Store the Evolution API message ID for delivery status tracking
                if wa_response and isinstance(wa_response, dict):
                    evo_id = (
                        wa_response.get("key", {}).get("id")
                        or wa_response.get("id")
                    )
                    if evo_id:
                        msg.evolution_msg_id = evo_id
                        await db.commit()
            except Exception:
                logger.exception("WhatsApp send failed for session %s", session_id)

    tenant_key = str(current_user.tenant_id)
    event_data = {
        "event": "message",
        "session_id": str(session_id),
        "sender_type": "agent",
        "sender_id": str(current_user.id),
        "body": text,
        "created_at": msg.created_at.isoformat(),
    }
    # Visitor's WS is keyed by visitor_id (the client-side UUID for widget, phone for WA)
    await manager.broadcast_to_session(tenant_key, session.visitor_id, event_data)
    await manager.broadcast_to_agents(tenant_key, event_data)

    return {"id": str(msg.id), "body": msg.body, "created_at": msg.created_at.isoformat(), "msg_status": msg.msg_status}


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


class PatchSessionBody(BaseModel):
    ticket_id: Optional[uuid.UUID] = None
    contact_id: Optional[uuid.UUID] = None


@router.patch("/sessions/{session_id}", status_code=status.HTTP_200_OK)
async def patch_session(session_id: uuid.UUID, body: PatchSessionBody, current_user: CurrentUser, db: DB):
    sess_result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.tenant_id == current_user.tenant_id,
        )
    )
    session = sess_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if body.ticket_id is not None:
        session.ticket_id = body.ticket_id
        session.status = "ticket"
    if body.contact_id is not None:
        contact = await db.get(Contact, body.contact_id)
        if not contact or contact.tenant_id != current_user.tenant_id:
            raise HTTPException(status_code=404, detail="Contact not found")
        session.contact_id = body.contact_id
        if not session.visitor_name:
            session.visitor_name = contact.full_name
    await db.commit()
    await db.refresh(session)
    await _broadcast_session_update(current_user.tenant_id, session.id)
    return _session_dict(session)


async def _broadcast_session_update(tenant_id: uuid.UUID, session_id: uuid.UUID) -> None:
    await manager.broadcast_to_agents(
        str(tenant_id), {"event": "session_update", "session_id": str(session_id)}
    )


class AssignBody(BaseModel):
    assigned_to: Optional[uuid.UUID] = None


@router.post("/sessions/{session_id}/assign", status_code=status.HTTP_200_OK)
async def assign_session(session_id: uuid.UUID, body: AssignBody, current_user: CurrentUser, db: DB):
    """Assign (or unassign) a session. assigned_to=null returns it to the open pool."""
    sess_result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.tenant_id == current_user.tenant_id,
        )
    )
    session = sess_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if body.assigned_to is not None:
        agent = await db.get(User, body.assigned_to)
        if not agent or agent.tenant_id != current_user.tenant_id:
            raise HTTPException(status_code=404, detail="Agent not found")
        session.assigned_to = body.assigned_to
        if session.status in ("open", "assigned"):
            session.status = "assigned"
    else:
        session.assigned_to = None
        if session.status == "assigned":
            session.status = "open"

    await db.commit()
    await db.refresh(session)
    await _broadcast_session_update(current_user.tenant_id, session.id)
    name = None
    if session.assigned_to:
        name = await db.scalar(select(User.full_name).where(User.id == session.assigned_to))
    return _session_dict(session, name)


@router.post("/sessions/{session_id}/claim", status_code=status.HTTP_200_OK)
async def claim_session(session_id: uuid.UUID, current_user: CurrentUser, db: DB):
    """Auto-assign to the current agent when they open an unassigned session."""
    sess_result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.tenant_id == current_user.tenant_id,
        )
    )
    session = sess_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.assigned_to is None and session.status == "open":
        session.assigned_to = current_user.id
        session.status = "assigned"
        await db.commit()
        await db.refresh(session)
        await _broadcast_session_update(current_user.tenant_id, session.id)

    name = None
    if session.assigned_to:
        name = await db.scalar(select(User.full_name).where(User.id == session.assigned_to))
    return _session_dict(session, name)


class StatusBody(BaseModel):
    status: str


@router.post("/sessions/{session_id}/status", status_code=status.HTTP_200_OK)
async def set_session_status(session_id: uuid.UUID, body: StatusBody, current_user: CurrentUser, db: DB):
    if body.status not in ("open", "assigned", "solved", "ticket"):
        raise HTTPException(status_code=400, detail="Invalid status")
    sess_result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.tenant_id == current_user.tenant_id,
        )
    )
    session = sess_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.status = body.status
    if body.status == "solved":
        session.solved_at = datetime.now(timezone.utc)
    elif body.status == "open":
        session.solved_at = None
        session.assigned_to = None
    await db.commit()
    await db.refresh(session)
    await _broadcast_session_update(current_user.tenant_id, session.id)
    name = None
    if session.assigned_to:
        name = await db.scalar(select(User.full_name).where(User.id == session.assigned_to))
    return _session_dict(session, name)


# ---------------------------------------------------------------------------
# Bulk session actions
# ---------------------------------------------------------------------------

class BulkSessionBody(BaseModel):
    action: str  # "close" | "reopen" | "delete"
    session_ids: list[uuid.UUID]


@router.post("/sessions/bulk", status_code=status.HTTP_200_OK)
async def bulk_session_action(body: BulkSessionBody, current_user: CurrentUser, db: DB):
    """Perform a bulk action (close / reopen / delete) on multiple sessions."""
    if body.action not in ("close", "reopen", "delete"):
        raise HTTPException(status_code=400, detail="action must be close, reopen, or delete")
    if not body.session_ids:
        return {"updated": 0}

    result = await db.execute(
        select(ChatSession).where(
            ChatSession.tenant_id == current_user.tenant_id,
            ChatSession.id.in_(body.session_ids),
        )
    )
    sessions = result.scalars().all()

    now = datetime.now(timezone.utc)
    count = 0

    if body.action == "close":
        for s in sessions:
            s.status = "solved"
            s.is_open = False
            s.solved_at = now
            count += 1
    elif body.action == "reopen":
        for s in sessions:
            s.status = "open"
            s.is_open = True
            s.solved_at = None
            count += 1
    elif body.action == "delete":
        ids = [s.id for s in sessions]
        await db.execute(delete(ChatMessage).where(ChatMessage.session_id.in_(ids)))
        await db.execute(delete(ChatSession).where(ChatSession.id.in_(ids)))
        count = len(ids)

    await db.commit()

    if body.action != "delete":
        tenant_key = str(current_user.tenant_id)
        for s in sessions:
            await manager.broadcast_to_agents(
                tenant_key, {"event": "session_update", "session_id": str(s.id)}
            )

    return {"updated": count}


class ChatSettingsBody(BaseModel):
    hide_solved_chats_hours: int


@router.get("/settings")
async def get_chat_settings(current_user: CurrentUser, db: DB):
    tenant = await db.get(Tenant, current_user.tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return {"hide_solved_chats_hours": tenant.hide_solved_chats_hours}


@router.patch("/settings", status_code=status.HTTP_200_OK)
async def update_chat_settings(body: ChatSettingsBody, current_user: CurrentUser, db: DB):
    tenant = await db.get(Tenant, current_user.tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    hours = max(1, min(body.hide_solved_chats_hours, 8760))
    tenant.hide_solved_chats_hours = hours
    await db.commit()
    return {"hide_solved_chats_hours": hours}


@router.get("/agents")
async def list_chat_agents(current_user: CurrentUser, db: DB):
    rows = await db.execute(
        select(User.id, User.full_name)
        .where(User.tenant_id == current_user.tenant_id, User.is_active == True)  # noqa: E712
        .order_by(User.full_name)
    )
    return [{"id": str(uid), "full_name": name} for uid, name in rows.all()]


class NoteBody(BaseModel):
    body: str


@router.post("/sessions/{session_id}/note", status_code=status.HTTP_201_CREATED)
async def add_note(session_id: uuid.UUID, payload: NoteBody, current_user: CurrentUser, db: DB):
    """Internal agent note — stored as a ChatMessage with sender_type='note',
    never dispatched to WhatsApp."""
    sess_result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.tenant_id == current_user.tenant_id,
        )
    )
    session = sess_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    text = payload.body.strip()
    if not text:
        raise HTTPException(status_code=400, detail="body must not be empty")

    msg = ChatMessage(
        tenant_id=current_user.tenant_id,
        session_id=session.id,
        sender_type="note",
        sender_id=str(current_user.id),
        body=text,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    await manager.broadcast_to_agents(
        str(current_user.tenant_id),
        {"event": "message", "session_id": str(session_id), "sender_type": "note", "body": text},
    )
    return {"id": str(msg.id), "sender_type": "note", "body": msg.body, "created_at": msg.created_at.isoformat()}


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
    except RuntimeError as exc:
        # EVOLUTION_API_URL not set in this environment
        logger.warning("WhatsApp QR requested but Evolution API is not configured: %s", exc)
        raise HTTPException(status_code=503, detail="WhatsApp integration is not configured for this environment")
    except httpx.HTTPStatusError as exc:
        logger.error(
            "Evolution API returned %s for tenant '%s': %s",
            exc.response.status_code,
            tenant.slug,
            exc.response.text,
        )
        raise HTTPException(status_code=502, detail="Evolution API error — check server logs")
    except Exception as exc:
        logger.error(
            "Could not reach Evolution API for tenant '%s': %s: %s",
            tenant.slug,
            type(exc).__name__,
            exc,
        )
        raise HTTPException(status_code=502, detail="Could not reach Evolution API")

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
                    logger.exception("WhatsApp send failed for contact %s", contact.id)

                event_data = {
                    "event": "message",
                    "session_id": str(session.id),
                    "sender_type": "agent",
                    "sender_id": str(created_by_id),
                    "body": text,
                    "created_at": msg.created_at.isoformat(),
                }
                await manager.broadcast_to_session(tenant_key, session.visitor_id, event_data)
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

@webhook_router.post("/webhooks/{tenant_slug}/whatsapp", status_code=status.HTTP_200_OK)
async def whatsapp_incoming(tenant_slug: str, request: Request, db: DB):
    """Receive inbound WhatsApp messages from Evolution API. No auth — called by Evolution.
    https://{env}.getyippie.com/api/v1/chat/webhooks/{slug}/whatsapp"""
    try:
        payload = await request.json()
    except Exception:
        return {"status": "ignored"}

    logger.debug("Evolution webhook payload for %s: %s", tenant_slug, payload)
    tenant_id = await resolve_tenant_by_slug(db, tenant_slug)
    await set_tenant_context(db, tenant_id)

    # Handle message status update events (delivery/read receipts)
    event_type = payload.get("event") or payload.get("type", "")
    if event_type == "message.update" or payload.get("action") == "message.update":
        try:
            data = payload.get("data", payload)
            evo_msg_id = data.get("key", {}).get("id") or data.get("id")
            raw_status = (data.get("update", {}).get("status") or data.get("status", "")).upper()
            if evo_msg_id and raw_status:
                status_map = {
                    "DELIVERY_ACK": "delivered",
                    "READ": "read",
                    "PLAYED": "read",
                }
                new_status = status_map.get(raw_status)
                if new_status:
                    msg_result = await db.execute(
                        select(ChatMessage).where(
                            ChatMessage.evolution_msg_id == evo_msg_id,
                            ChatMessage.tenant_id == tenant_id,
                        )
                    )
                    msg = msg_result.scalar_one_or_none()
                    if msg:
                        msg.msg_status = new_status
                        await db.commit()
                        await manager.broadcast_to_agents(
                            str(tenant_id),
                            {
                                "event": "msg_status_update",
                                "msg_id": str(msg.id),
                                "status": new_status,
                            },
                        )
        except Exception:
            logger.exception("Error processing message status update for tenant %s", tenant_slug)
        return {"status": "ok"}

    result = await whatsapp_service.handle_incoming_webhook(db, tenant_id, payload)
    if result:
        tenant_key = str(tenant_id)
        event_data = {
            "event": "message",
            "session_id": result["session_id"],
            "sender_type": "visitor",
            "sender_id": result["visitor_id"],
            "body": result["body"],
            "created_at": result["created_at"],
            "assigned_to": result.get("assigned_to"),
        }
        await manager.broadcast_to_agents(tenant_key, event_data)
        if result["is_new_session"]:
            await manager.broadcast_to_agents(tenant_key, {"event": "new_session", "session_id": result["session_id"]})
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Public REST endpoint — widget history (no auth)
# ---------------------------------------------------------------------------

@ws_router.get("/public/sessions/{visitor_id}/messages")
async def get_widget_session_messages(visitor_id: str, tenant_slug: str, db: DB):
    """Return message history for a widget session identified by visitor_id.

    No authentication required — called by the embeddable widget on page load
    to restore chat history before connecting via WebSocket.
    Returns {"messages": [...]} even when no session exists (empty list).
    """
    try:
        tenant_id = await resolve_tenant_uuid(db)
    except Exception:
        return {"messages": []}

    result = await db.execute(
        select(ChatSession)
        .where(
            ChatSession.visitor_id == visitor_id,
            ChatSession.tenant_id == tenant_id,
            ChatSession.source == "websocket",
        )
        .order_by(ChatSession.started_at.desc())
        .limit(1)
    )
    session = result.scalar_one_or_none()
    if not session:
        return {"messages": []}

    msg_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at.asc())
    )
    msgs = msg_result.scalars().all()

    return {
        "messages": [
            {
                "body": m.body,
                "sender_type": m.sender_type,
                "created_at": m.created_at.isoformat(),
            }
            for m in msgs
            if m.sender_type in ("visitor", "agent")
        ]
    }


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
                ChatSession.is_open == True,  # noqa: E712
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
                {"event": "new_session", "session_id": str(session.id)},
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
                sess_row = await db.get(ChatSession, session.id)
                if sess_row:
                    sess_row.unread_count = (sess_row.unread_count or 0) + 1
                await db.commit()

            visitor_event = {
                "event": "message",
                "session_id": str(session.id),  # DB UUID — agents use this for query invalidation
                "sender_type": "visitor",
                "sender_id": session_id,
                "body": msg_body,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            # Visitor's WS is keyed by client-side session_id, not the DB UUID
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
