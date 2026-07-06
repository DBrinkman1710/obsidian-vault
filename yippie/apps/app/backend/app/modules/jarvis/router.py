from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import CurrentUser
from app.core.models import Tenant, UserReminder
from app.database import db_session, get_db, set_tenant_context
from app.modules.jarvis import agent, service, threads
from app.modules.jarvis.schemas import (
    CaptureRequest,
    CaptureResponse,
    ConfirmRequest,
    ReminderOut,
    ThreadMessageOut,
    ThreadOut,
    TrainRequest,
)

router = APIRouter(prefix="/jarvis", tags=["jarvis"])

DB = Annotated[AsyncSession, Depends(get_db)]


@router.post("/capture", response_model=CaptureResponse)
async def capture(body: CaptureRequest, current_user: CurrentUser, db: DB):
    if not body.body.strip():
        raise HTTPException(status_code=400, detail="Input is empty")
    tenant = await db.get(Tenant, current_user.tenant_id)
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # [YIP-STREAM] server side history: continue the thread when one is given,
    # else fall back to the client supplied turns (older clients).
    thread = await threads.get_or_create_thread(
        db, current_user.tenant_id, current_user.id, body.thread_id
    )
    if body.thread_id and thread.id == body.thread_id:
        history = await threads.load_history(db, thread, limit=agent.MAX_HISTORY)
    else:
        history = [t.model_dump() for t in body.history]
    await threads.append_message(db, thread, "user", body.body)

    result = await agent.run_agent(
        db, current_user, tenant, body.body,
        body.context_type, body.context_id,
        route=body.route,
        history=history,
    )
    await threads.append_message(
        db, thread, "assistant", result.get("summary") or "",
        action_taken=result.get("action_taken"),
        inline_data=result.get("inline_data"),
        actions=result.get("actions"),
    )
    await db.commit()
    return CaptureResponse(**result, thread_id=thread.id)


@router.post("/capture/stream")
async def capture_stream(body: CaptureRequest, current_user: CurrentUser):
    """[YIP-STREAM] SSE variant of /capture.

    Frames (data: <json>\\n\\n): thread → status/delta… → result | error.
    The terminal result carries the full CaptureResponse and is authoritative;
    streamed deltas are a preview only. The DB session is opened inside the
    generator — it must outlive the response, so the get_db dependency (torn
    down on request scope) is deliberately not used here.
    """
    if not body.body.strip():
        raise HTTPException(status_code=400, detail="Input is empty")

    def frame(payload: dict) -> str:
        return f"data: {json.dumps(payload, default=str)}\n\n"

    async def gen():
        try:
            async with db_session() as db:
                await set_tenant_context(db, current_user.tenant_id)
                tenant = await db.get(Tenant, current_user.tenant_id)
                if tenant is None:
                    yield frame({"type": "error", "detail": "Tenant not found"})
                    return

                thread = await threads.get_or_create_thread(
                    db, current_user.tenant_id, current_user.id, body.thread_id
                )
                if body.thread_id and thread.id == body.thread_id:
                    history = await threads.load_history(db, thread, limit=agent.MAX_HISTORY)
                else:
                    history = [t.model_dump() for t in body.history]
                await threads.append_message(db, thread, "user", body.body)
                yield frame({"type": "thread", "thread_id": str(thread.id)})

                result: dict | None = None
                async for event in agent.run_agent_stream(
                    db, current_user, tenant, body.body,
                    body.context_type, body.context_id,
                    route=body.route, history=history,
                ):
                    if event["type"] == "result":
                        result = event["data"]
                    else:
                        yield frame(event)

                if result is None:
                    result = {"action_taken": "answer", "summary": "Done."}
                await threads.append_message(
                    db, thread, "assistant", result.get("summary") or "",
                    action_taken=result.get("action_taken"),
                    inline_data=result.get("inline_data"),
                    actions=result.get("actions"),
                )
                await db.commit()
                result["thread_id"] = str(thread.id)
                yield frame({"type": "result", "data": result})
        except Exception:
            yield frame({"type": "error", "detail": "Yip hit an error — please try again"})

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/confirm", response_model=CaptureResponse)
async def confirm(body: ConfirmRequest, current_user: CurrentUser, db: DB):
    """[YIP3] Execute a write action after the user pressed Confirm in the popup."""
    tenant = await db.get(Tenant, current_user.tenant_id)
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    result = await agent.execute_confirmed(db, current_user, tenant, body.tool, body.args)
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    # [YIP-STREAM] record the outcome in the thread so reopening shows it.
    if body.thread_id:
        thread = await threads.get_thread(db, current_user.tenant_id, current_user.id, body.thread_id)
        if thread:
            await threads.append_message(
                db, thread, "assistant", result.get("summary") or "",
                action_taken=result.get("action_taken"),
                actions=result.get("actions"),
            )
            await db.commit()
    return CaptureResponse(**result, thread_id=body.thread_id)


@router.get("/threads", response_model=list[ThreadOut])
async def list_threads(current_user: CurrentUser, db: DB):
    """[YIP-STREAM] The user's recent Yip conversations, newest first."""
    return await threads.list_threads(db, current_user.tenant_id, current_user.id)


@router.get("/threads/{thread_id}/messages", response_model=list[ThreadMessageOut])
async def thread_messages(thread_id: uuid.UUID, current_user: CurrentUser, db: DB):
    messages = await threads.list_messages(db, current_user.tenant_id, current_user.id, thread_id)
    if messages is None:
        raise HTTPException(status_code=404, detail="Thread not found")
    return messages


@router.post("/train")
async def train(body: TrainRequest, current_user: CurrentUser, db: DB):
    """Synthesise a Yip training conversation into an ai_profile and save it."""
    tenant = await db.get(Tenant, current_user.tenant_id)
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    profile = await service.synthesise_profile(body.messages, tenant)
    tenant.ai_profile = profile
    await db.commit()
    return {"profile": profile}


@router.get("/reminders", response_model=list[ReminderOut])
async def list_reminders(current_user: CurrentUser, db: DB):
    result = await db.execute(
        select(UserReminder)
        .where(UserReminder.user_id == current_user.id, UserReminder.dismissed_at.is_(None))
        .order_by(UserReminder.remind_at)
    )
    return result.scalars().all()


@router.patch("/reminders/{reminder_id}/dismiss")
async def dismiss_reminder(reminder_id: uuid.UUID, current_user: CurrentUser, db: DB):
    reminder = await db.get(UserReminder, reminder_id)
    if not reminder or reminder.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Reminder not found")
    reminder.dismissed_at = datetime.now(timezone.utc)
    await db.commit()
    return {"dismissed": True}
