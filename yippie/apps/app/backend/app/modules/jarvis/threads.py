"""[YIP-STREAM] Thread persistence — Yip conversations survive closing the popup.

The router owns the flow: get/create a thread, append the user turn, run the
agent, append the assistant turn. History is derived server side from the
thread's stored messages (client history is only a fallback for old clients).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.jarvis.models import JarvisMessage, JarvisThread

MAX_THREADS_LISTED = 15
THREAD_RETENTION_DAYS = 30


async def get_thread(
    db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, thread_id: uuid.UUID
) -> JarvisThread | None:
    """A thread owned by this user, or None. RLS is tenant level; ownership is ours."""
    thread = await db.get(JarvisThread, thread_id)
    if thread and thread.tenant_id == tenant_id and thread.user_id == user_id:
        return thread
    return None


async def get_or_create_thread(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    thread_id: uuid.UUID | None = None,
    kind: str = "chat",
) -> JarvisThread:
    """Resolve the thread to continue; a stale/foreign id silently starts fresh."""
    if thread_id:
        thread = await get_thread(db, tenant_id, user_id, thread_id)
        if thread:
            return thread
    thread = JarvisThread(tenant_id=tenant_id, user_id=user_id, kind=kind)
    db.add(thread)
    await db.flush()
    return thread


async def append_message(
    db: AsyncSession,
    thread: JarvisThread,
    role: str,
    content: str,
    action_taken: str | None = None,
    inline_data: dict | None = None,
    actions: list | None = None,
) -> JarvisMessage:
    msg = JarvisMessage(
        thread_id=thread.id,
        tenant_id=thread.tenant_id,
        role=role,
        content=content,
        action_taken=action_taken,
        inline_data=inline_data,
        actions=actions,
    )
    db.add(msg)
    if role == "user" and not thread.title:
        thread.title = content.strip()[:120]
    thread.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return msg


async def load_history(db: AsyncSession, thread: JarvisThread, limit: int = 12) -> list[dict]:
    """The last `limit` turns as {role, content}, oldest first — agent history shape."""
    result = await db.execute(
        select(JarvisMessage.role, JarvisMessage.content)
        .where(JarvisMessage.tenant_id == thread.tenant_id, JarvisMessage.thread_id == thread.id)
        .order_by(JarvisMessage.created_at.desc())
        .limit(limit)
    )
    rows = list(result.all())
    rows.reverse()
    return [{"role": r, "content": c} for r, c in rows]


async def list_threads(
    db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, limit: int = MAX_THREADS_LISTED
) -> list[JarvisThread]:
    result = await db.execute(
        select(JarvisThread)
        .where(JarvisThread.tenant_id == tenant_id, JarvisThread.user_id == user_id)
        .order_by(JarvisThread.updated_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def list_messages(
    db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, thread_id: uuid.UUID
) -> list[JarvisMessage] | None:
    """All messages of an owned thread, oldest first; None when not the owner."""
    thread = await get_thread(db, tenant_id, user_id, thread_id)
    if thread is None:
        return None
    result = await db.execute(
        select(JarvisMessage)
        .where(JarvisMessage.tenant_id == tenant_id, JarvisMessage.thread_id == thread_id)
        .order_by(JarvisMessage.created_at.asc())
    )
    return list(result.scalars().all())


async def cleanup_old_threads(db: AsyncSession) -> int:
    """Drop threads idle past retention; messages cascade. Cross tenant (scheduler)."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=THREAD_RETENTION_DAYS)
    result = await db.execute(delete(JarvisThread).where(JarvisThread.updated_at < cutoff))
    return result.rowcount or 0
