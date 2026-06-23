"""Shared async AI completion helper.

Wraps the Anthropic client so callers don't need to import or configure it
directly. Returns the model's text response as a plain string.
"""
from __future__ import annotations

import anthropic

from app.config import get_settings


def _client() -> anthropic.AsyncAnthropic:
    return anthropic.AsyncAnthropic(api_key=get_settings().anthropic_api_key)


def _model() -> str:
    return get_settings().ai_model


async def ai_completion(
    messages: list[dict],
    *,
    max_tokens: int = 512,
    system: str | None = None,
) -> str:
    kwargs: dict = {
        "model": _model(),
        "max_tokens": max_tokens,
        "messages": messages,
    }
    if system:
        kwargs["system"] = system

    message = await _client().messages.create(**kwargs)

    for block in getattr(message, "content", None) or []:
        text = getattr(block, "text", None)
        if text:
            return text.strip()
    return ""
