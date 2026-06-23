from __future__ import annotations

import time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth.dependencies import get_current_user, require_admin
from app.config import get_settings
from app.core.models import User
from app.modules.ai.client import active_provider_label, ai_completion

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/status")
async def ai_status(_: User = Depends(get_current_user)):
    """Return the active AI provider and model configuration."""
    s = get_settings()
    return {
        "provider": s.ai_provider,
        "model": s.ai_model,
        "label": active_provider_label(),
        "base_url": s.ai_base_url if s.ai_provider == "self-hosted" else None,
    }


class AITestRequest(BaseModel):
    text: str


@router.post("/test")
async def ai_test(body: AITestRequest, _: User = Depends(require_admin)):
    """Make a cheap test call to the active AI provider.

    Runs the input text through the inbox scanner prompt and returns
    the raw structured output + latency. Use this to verify a new
    provider works before switching production traffic.
    """
    if not body.text or not body.text.strip():
        raise HTTPException(status_code=422, detail="text must not be empty")

    from app.modules.inbox.ai_scanner import scan_message

    t0 = time.monotonic()
    try:
        result = await scan_message(
            sender="test@example.com",
            raw_body=body.text,
            source="email",
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI provider error: {exc}") from exc

    latency_ms = round((time.monotonic() - t0) * 1000)
    s = get_settings()
    return {
        "provider": s.ai_provider,
        "model": s.ai_model,
        "latency_ms": latency_ms,
        "result": {
            "subject": result.subject,
            "description": result.description,
            "priority": result.priority,
            "category": result.category,
            "language": result.language,
        },
    }
