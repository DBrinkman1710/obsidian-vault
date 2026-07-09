from __future__ import annotations

import asyncio
import base64
import logging
import mimetypes
import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from fastapi import HTTPException
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.flow_events import emit_flow_event
from app.core.models import Tenant, User
from app.database import db_session, set_tenant_context
from app.modules.booking import service as booking_service
from app.modules.booking.schemas import BookingTokenCreate
from app.modules.chat import whatsapp_service
from app.modules.chat.manager import manager
from app.modules.chat.models import ChatMessage, ChatSession
from app.modules.contacts.models import Contact

logger = logging.getLogger(__name__)


async def emit_conversation_started(db: AsyncSession, session: ChatSession) -> None:
    """[FLOW7] Flow event for a freshly created live chat conversation (emitted at
    every new-session site, in the same transaction as the insert)."""
    await emit_flow_event(
        db, session.tenant_id, "conversation_started",
        entity_type="conversation", entity_id=session.id,
        contact_id=session.contact_id,
        payload={
            "source": session.source,
            "visitor_name": session.visitor_name,
            "contact_id": session.contact_id,
        },
    )


async def emit_conversation_solved(db: AsyncSession, session: ChatSession) -> None:
    """[FLOW7] Flow event for a conversation being marked solved/closed."""
    await emit_flow_event(
        db, session.tenant_id, "conversation_solved",
        entity_type="conversation", entity_id=session.id,
        contact_id=session.contact_id,
        payload={
            "source": session.source,
            "assigned_to": str(session.assigned_to) if session.assigned_to else None,
            "contact_id": session.contact_id,
        },
    )


async def get_session(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    session_id: uuid.UUID,
) -> ChatSession | None:
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.tenant_id == tenant_id,
        )
    )
    return result.scalar_one_or_none()


async def get_assignee_name(db: AsyncSession, assigned_to: uuid.UUID | None) -> str | None:
    if assigned_to is None:
        return None
    return await db.scalar(select(User.full_name).where(User.id == assigned_to))


async def find_or_create_open_session(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    phone: str,
    contact_id: Optional[uuid.UUID] = None,
    visitor_name: Optional[str] = None,
) -> ChatSession:
    phone = whatsapp_service.normalize_phone(phone)

    # Contact-id lookup first — more reliable than phone-format matching when the agent
    # opens a conversation for a contact that already has an inbound session.
    if contact_id:
        cid_result = await db.execute(
            select(ChatSession).where(
                ChatSession.tenant_id == tenant_id,
                ChatSession.contact_id == contact_id,
                ChatSession.source == "whatsapp",
                ChatSession.is_open == True,  # noqa: E712
            ).limit(1)
        )
        existing = cid_result.scalars().first()
        if existing:
            if visitor_name and not existing.visitor_name:
                existing.visitor_name = visitor_name
            return existing

    session = await whatsapp_service.find_open_session_for_phone(db, tenant_id, phone)
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
        await emit_conversation_started(db, session)
    else:
        if contact_id and not session.contact_id:
            session.contact_id = contact_id
        if visitor_name and not session.visitor_name:
            session.visitor_name = visitor_name
    return session


async def list_sessions(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    filter: str,
    contact_id: Optional[uuid.UUID],
    status_filter: Optional[str],
    user_id: Optional[uuid.UUID] = None,
) -> list[tuple[ChatSession, str | None]]:
    stmt = select(ChatSession).where(ChatSession.tenant_id == tenant_id)

    if contact_id is not None:
        stmt = stmt.where(ChatSession.contact_id == contact_id)
    if status_filter is not None:
        stmt = stmt.where(ChatSession.status == status_filter)

    if contact_id is None and status_filter is None:
        if filter == "mine":
            stmt = stmt.where(ChatSession.assigned_to == user_id)
        elif filter == "open":
            stmt = stmt.where(ChatSession.status == "open")

        tenant = await db.get(Tenant, tenant_id)
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

    return [(s, names.get(s.assigned_to) if s.assigned_to else None) for s in sessions]


async def count_open_sessions(db: AsyncSession, tenant_id: uuid.UUID) -> int:
    count = await db.scalar(
        select(func.count(ChatSession.id)).where(
            ChatSession.tenant_id == tenant_id,
            ChatSession.unread_count > 0,
        )
    )
    return count or 0


async def get_messages(db: AsyncSession, session_id: uuid.UUID) -> list[ChatMessage]:
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
    )
    return list(result.scalars().all())


async def send_reply(
    db: AsyncSession,
    session: ChatSession,
    session_id: uuid.UUID,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    text: str,
) -> dict:
    """Create an agent reply message and dispatch it to WhatsApp if applicable.

    Returns a dict with keys: msg, active_session_id, session, original_session_id.
    session may differ from the input if a duplicate-session merge occurred.
    Commits the transaction internally; rolls back and raises on WhatsApp failure.
    """
    msg = ChatMessage(
        tenant_id=tenant_id,
        session_id=session.id,
        sender_type="agent",
        sender_id=str(user_id),
        body=text,
    )
    db.add(msg)
    await db.flush()
    await db.refresh(msg)

    active_session_id = session_id

    if session.source == "whatsapp" and session.whatsapp_phone:
        tenant = await db.get(Tenant, tenant_id)
        if tenant:
            try:
                wa_response = await whatsapp_service.send_text(tenant.slug, session.whatsapp_phone, text)
                if wa_response and isinstance(wa_response, dict):
                    remote_jid = wa_response.get("key", {}).get("remoteJid", "")
                    if remote_jid:
                        canonical = whatsapp_service.normalize_phone(remote_jid)
                        if canonical and canonical != session.whatsapp_phone:
                            # Check if another open session already owns the canonical phone.
                            # This is the "two open sessions per contact" bug: an inbound session
                            # was created with the E.164 JID while an outbound session was created
                            # from the locally-formatted contact phone. Merge them now.
                            sibling_result = await db.execute(
                                select(ChatSession).where(
                                    ChatSession.tenant_id == tenant_id,
                                    ChatSession.whatsapp_phone == canonical,
                                    ChatSession.is_open == True,  # noqa: E712
                                    ChatSession.id != session.id,
                                ).limit(1)
                            )
                            sibling = sibling_result.scalars().first()
                            if sibling:
                                await db.execute(
                                    update(ChatMessage)
                                    .where(
                                        ChatMessage.session_id == session.id,
                                        ChatMessage.tenant_id == tenant_id,
                                    )
                                    .values(session_id=sibling.id)
                                )
                                now = datetime.now(timezone.utc)
                                hide_hours = (tenant.hide_solved_chats_hours or 72) + 1
                                session.is_open = False
                                session.status = "solved"
                                session.solved_at = now - timedelta(hours=hide_hours)
                                session.ended_at = now
                                active_session_id = sibling.id
                                session = sibling
                            else:
                                session.whatsapp_phone = canonical
                                session.visitor_id = canonical
                    evo_id = (
                        wa_response.get("key", {}).get("id")
                        or wa_response.get("id")
                    )
                    if evo_id:
                        msg.evolution_msg_id = evo_id
                await db.commit()
            except HTTPException:
                raise
            except httpx.HTTPStatusError as exc:
                await db.rollback()
                evo_detail = exc.response.text[:400]
                try:
                    body = exc.response.json()
                    evo_detail = (body.get("message") or body.get("error") or str(body))[:400]
                except Exception:
                    pass
                logger.error("WhatsApp send failed [%s]: %s", exc.response.status_code, evo_detail)
                raise HTTPException(
                    status_code=422,
                    detail=f"Evolution API {exc.response.status_code}: {evo_detail}",
                )
            except Exception as exc:
                await db.rollback()
                logger.exception("WhatsApp send failed for session %s", session_id)
                raise HTTPException(
                    status_code=422,
                    detail=f"WhatsApp send error: {type(exc).__name__}: {str(exc)[:300]}",
                )
    else:
        await db.commit()
        await db.refresh(msg)

    return {
        "msg": msg,
        "active_session_id": active_session_id,
        "session": session,
        "original_session_id": session_id,
    }


async def send_media(
    db: AsyncSession,
    session: ChatSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    file_bytes: bytes,
    content_type: str,
    filename: str,
    caption: Optional[str],
) -> ChatMessage:
    """Upload and dispatch a media message. Commits internally; rolls back on WA failure."""
    media_base64 = base64.b64encode(file_bytes).decode()
    is_image = content_type.startswith("image/")
    evo_media_type = "image" if is_image else "document"
    data_uri = f"data:{content_type};base64,{media_base64}"
    content_text = caption or filename

    msg = ChatMessage(
        tenant_id=tenant_id,
        session_id=session.id,
        sender_type="agent",
        sender_id=str(user_id),
        body=content_text,
        msg_type="media",
        media_url=data_uri,
        media_filename=filename,
        media_mime=content_type,
    )
    db.add(msg)
    await db.flush()
    await db.refresh(msg)

    if session.source == "whatsapp" and session.whatsapp_phone:
        tenant = await db.get(Tenant, tenant_id)
        if tenant:
            try:
                wa_response = await whatsapp_service.send_media(
                    tenant.slug,
                    session.whatsapp_phone,
                    media_base64,
                    evo_media_type,
                    filename,
                    caption,
                )
                if wa_response and isinstance(wa_response, dict):
                    remote_jid = wa_response.get("key", {}).get("remoteJid", "")
                    if remote_jid:
                        canonical = whatsapp_service.normalize_phone(remote_jid)
                        if canonical and canonical != session.whatsapp_phone:
                            session.whatsapp_phone = canonical
                            session.visitor_id = canonical
                    evo_id = (
                        wa_response.get("key", {}).get("id")
                        or wa_response.get("id")
                    )
                    if evo_id:
                        msg.evolution_msg_id = evo_id
                await db.commit()
            except HTTPException:
                raise
            except httpx.HTTPStatusError as exc:
                await db.rollback()
                evo_detail = exc.response.text[:400]
                try:
                    body = exc.response.json()
                    evo_detail = (body.get("message") or body.get("error") or str(body))[:400]
                except Exception:
                    pass
                logger.error("WhatsApp media send failed [%s]: %s", exc.response.status_code, evo_detail)
                raise HTTPException(
                    status_code=422,
                    detail=f"Evolution API {exc.response.status_code}: {evo_detail}",
                )
            except Exception:
                await db.rollback()
                logger.exception("WhatsApp sendMedia failed for session %s", session.id)
                raise HTTPException(
                    status_code=422,
                    detail="WhatsApp delivery failed. Check that WhatsApp is still connected.",
                )
    else:
        await db.commit()
        await db.refresh(msg)

    return msg


async def close_session(db: AsyncSession, session: ChatSession) -> None:
    session.is_open = False
    session.ended_at = datetime.now(timezone.utc)
    await db.commit()


async def patch_session(
    db: AsyncSession,
    session: ChatSession,
    tenant_id: uuid.UUID,
    ticket_id: Optional[uuid.UUID],
    contact_id: Optional[uuid.UUID],
) -> ChatSession:
    if ticket_id is not None:
        session.ticket_id = ticket_id
        session.status = "ticket"
    if contact_id is not None:
        contact = await db.get(Contact, contact_id)
        if not contact or contact.tenant_id != tenant_id:
            raise HTTPException(status_code=404, detail="Contact not found")
        session.contact_id = contact_id
        if not session.visitor_name:
            session.visitor_name = contact.full_name
    await db.commit()
    await db.refresh(session)
    return session


async def assign_session(
    db: AsyncSession,
    session: ChatSession,
    tenant_id: uuid.UUID,
    assigned_to_id: Optional[uuid.UUID],
) -> tuple[ChatSession, str | None]:
    if assigned_to_id is not None:
        agent = await db.get(User, assigned_to_id)
        if not agent or agent.tenant_id != tenant_id:
            raise HTTPException(status_code=404, detail="Agent not found")
        session.assigned_to = assigned_to_id
        if session.status in ("open", "assigned"):
            session.status = "assigned"
    else:
        session.assigned_to = None
        if session.status == "assigned":
            session.status = "open"

    await db.commit()
    await db.refresh(session)
    name = await get_assignee_name(db, session.assigned_to)
    return session, name


async def claim_session(
    db: AsyncSession,
    session: ChatSession,
    user_id: uuid.UUID,
) -> tuple[ChatSession, str | None]:
    if session.assigned_to is None and session.status == "open":
        session.assigned_to = user_id
        session.status = "assigned"
        await db.commit()
        await db.refresh(session)

    name = await get_assignee_name(db, session.assigned_to)
    return session, name


async def set_session_status(
    db: AsyncSession,
    session: ChatSession,
    new_status: str,
) -> tuple[ChatSession, str | None]:
    session.status = new_status
    if new_status == "solved":
        session.solved_at = datetime.now(timezone.utc)
        await emit_conversation_solved(db, session)
    elif new_status == "open":
        session.solved_at = None
        session.assigned_to = None
    await db.commit()
    await db.refresh(session)
    name = await get_assignee_name(db, session.assigned_to)
    return session, name


async def bulk_session_action(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    action: str,
    session_ids: list[uuid.UUID],
) -> tuple[int, list[ChatSession]]:
    """Returns (count, updated_sessions). updated_sessions is empty for delete actions."""
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.tenant_id == tenant_id,
            ChatSession.id.in_(session_ids),
        )
    )
    sessions = list(result.scalars().all())

    now = datetime.now(timezone.utc)
    count = 0

    if action == "close":
        for s in sessions:
            s.status = "solved"
            s.is_open = False
            s.solved_at = now
            await emit_conversation_solved(db, s)
            count += 1
    elif action == "reopen":
        for s in sessions:
            s.status = "open"
            s.is_open = True
            s.solved_at = None
            count += 1
    elif action == "delete":
        ids = [s.id for s in sessions]
        await db.execute(delete(ChatMessage).where(ChatMessage.session_id.in_(ids)))
        await db.execute(delete(ChatSession).where(ChatSession.id.in_(ids)))
        count = len(ids)
        sessions = []

    await db.commit()
    return count, sessions


async def clear_all_sessions(db: AsyncSession, tenant_id: uuid.UUID) -> int:
    session_result = await db.execute(
        select(ChatSession).where(ChatSession.tenant_id == tenant_id)
    )
    sessions = session_result.scalars().all()
    ids = [s.id for s in sessions]
    if ids:
        await db.execute(delete(ChatMessage).where(ChatMessage.session_id.in_(ids)))
        await db.execute(delete(ChatSession).where(ChatSession.id.in_(ids)))
    await db.commit()
    return len(ids)


async def reset_livechat(db: AsyncSession, tenant_id: uuid.UUID) -> tuple[bool, int]:
    tenant = await db.get(Tenant, tenant_id)
    disconnected = False
    if tenant:
        try:
            disconnected = await whatsapp_service.disconnect_instance(tenant.slug)
        except Exception:
            logger.exception("Could not disconnect WhatsApp for tenant '%s'", tenant.slug if tenant else tenant_id)

    session_result = await db.execute(
        select(ChatSession).where(ChatSession.tenant_id == tenant_id)
    )
    sessions = session_result.scalars().all()
    ids = [s.id for s in sessions]
    if ids:
        await db.execute(delete(ChatMessage).where(ChatMessage.session_id.in_(ids)))
        await db.execute(delete(ChatSession).where(ChatSession.id.in_(ids)))
    await db.commit()
    return disconnected, len(ids)


async def get_chat_settings(db: AsyncSession, tenant_id: uuid.UUID) -> int:
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant.hide_solved_chats_hours


async def update_chat_settings(db: AsyncSession, tenant_id: uuid.UUID, hours: int) -> int:
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    hours = max(1, min(hours, 8760))
    tenant.hide_solved_chats_hours = hours
    await db.commit()
    return hours


async def list_agents(db: AsyncSession, tenant_id: uuid.UUID) -> list[dict]:
    rows = await db.execute(
        select(User.id, User.full_name)
        .where(User.tenant_id == tenant_id, User.is_active == True)  # noqa: E712
        .order_by(User.full_name)
    )
    return [{"id": str(uid), "full_name": name} for uid, name in rows.all()]


async def add_note(
    db: AsyncSession,
    session: ChatSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    text: str,
) -> ChatMessage:
    msg = ChatMessage(
        tenant_id=tenant_id,
        session_id=session.id,
        sender_type="note",
        sender_id=str(user_id),
        body=text,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


async def mark_session_read(db: AsyncSession, session: ChatSession) -> None:
    session.unread_count = 0
    await db.commit()


async def handle_message_status_update(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    evo_msg_id: str,
    raw_status: str,
) -> ChatMessage | None:
    status_map = {
        "DELIVERY_ACK": "delivered",
        "READ": "read",
        "PLAYED": "read",
    }
    new_status = status_map.get(raw_status.upper())
    if not new_status:
        return None

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
    return msg


async def validate_broadcast_contacts(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    contact_ids: list[uuid.UUID],
) -> list[uuid.UUID]:
    result = await db.execute(
        select(Contact.id).where(
            Contact.tenant_id == tenant_id,
            Contact.id.in_(contact_ids),
            Contact.phone.is_not(None),
            Contact.broadcast_opted_out == False,  # noqa: E712
        )
    )
    return [r[0] for r in result.all()]


async def run_broadcast(
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

                session = await find_or_create_open_session(
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


async def get_widget_messages(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    visitor_id: str,
) -> list[dict]:
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
        return []

    msg_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at.asc())
    )
    msgs = msg_result.scalars().all()

    return [
        {
            "body": m.body,
            "sender_type": m.sender_type,
            "created_at": m.created_at.isoformat(),
        }
        for m in msgs
        if m.sender_type in ("visitor", "agent")
    ]
