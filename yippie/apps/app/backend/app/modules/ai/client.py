from __future__ import annotations

import litellm

from app.config import get_settings

litellm.suppress_debug_info = True


def _check_provider_config(s) -> None:
    """Raise a clear error if the required credentials for the active provider are missing."""
    if s.ai_provider == "mistral" and not s.mistral_api_key:
        raise ValueError(
            "AI_PROVIDER=mistral requires MISTRAL_API_KEY to be set. "
            "Get a key at console.mistral.ai (EU-hosted, GDPR-safe)."
        )
    if s.ai_provider == "self-hosted" and not s.ai_base_url:
        raise ValueError(
            "AI_PROVIDER=self-hosted requires AI_BASE_URL to be set "
            "(e.g. http://your-hetzner-server:8000/v1)"
        )
    if s.ai_provider == "deepseek-api" and not s.deepseek_api_key:
        raise ValueError(
            "AI_PROVIDER=deepseek-api requires DEEPSEEK_API_KEY to be set"
        )
    if s.ai_provider == "anthropic" and not s.anthropic_api_key:
        raise ValueError(
            "AI_PROVIDER=anthropic requires ANTHROPIC_API_KEY to be set"
        )


def _apply_prompt_caching(messages: list[dict]) -> list[dict]:
    """Mark the system message for Anthropic prompt caching.

    The Yip agent's system prompt is large (persona + manual context + memories),
    so caching it cuts cost/latency dramatically on multi-turn conversations.
    Only applied for the anthropic provider; other providers ignore or reject it.
    """
    if not messages or messages[0].get("role") != "system":
        return messages
    system = messages[0]
    if isinstance(system.get("content"), str):
        cached = dict(system)
        cached["content"] = [
            {"type": "text", "text": system["content"], "cache_control": {"type": "ephemeral"}}
        ]
        return [cached] + messages[1:]
    return messages


async def _acompletion(messages: list[dict], *, max_tokens: int, **extra):
    """Dispatch a completion to the configured provider and return the raw response.

    Provider is controlled by AI_PROVIDER env var:
      "mistral"      — Mistral API (default; EU-hosted, GDPR-safe; uses MISTRAL_API_KEY)
      "anthropic"    — Anthropic API (uses ANTHROPIC_API_KEY)
      "deepseek-api" — DeepSeek API (uses DEEPSEEK_API_KEY; set AI_MODEL=deepseek-chat)
      "self-hosted"  — OpenAI-compatible endpoint (uses AI_BASE_URL; target: vLLM on Hetzner)
    """
    s = get_settings()
    _check_provider_config(s)

    if s.ai_provider == "mistral":
        return await litellm.acompletion(
            model=f"mistral/{s.ai_model}",
            api_key=s.mistral_api_key,
            messages=messages,
            max_tokens=max_tokens,
            **extra,
        )
    if s.ai_provider == "self-hosted":
        return await litellm.acompletion(
            model=f"openai/{s.ai_model}",
            base_url=s.ai_base_url,
            api_key="local",
            messages=messages,
            max_tokens=max_tokens,
            **extra,
        )
    if s.ai_provider == "deepseek-api":
        return await litellm.acompletion(
            model=f"deepseek/{s.ai_model}",
            api_key=s.deepseek_api_key,
            messages=messages,
            max_tokens=max_tokens,
            **extra,
        )
    return await litellm.acompletion(
        model=f"anthropic/{s.ai_model}",
        api_key=s.anthropic_api_key,
        messages=_apply_prompt_caching(messages),
        max_tokens=max_tokens,
        **extra,
    )


async def ai_completion(messages: list[dict], *, max_tokens: int = 512) -> str:
    """Call the configured AI provider. Returns the text content of the response."""
    resp = await _acompletion(messages, max_tokens=max_tokens)
    return (resp.choices[0].message.content or "").strip()


async def ai_completion_tools(messages: list[dict], *, tools: list[dict], max_tokens: int = 1024):
    """Tool-calling completion. Returns the full assistant message (content + tool_calls).

    `tools` uses the OpenAI function-calling schema; litellm translates it for
    every provider (Anthropic tool_use blocks, Mistral function calling, etc.).
    """
    resp = await _acompletion(messages, max_tokens=max_tokens, tools=tools, tool_choice="auto")
    return resp.choices[0].message


def active_provider_label() -> str:
    """Human-readable label for the currently active AI provider (for status endpoints)."""
    s = get_settings()
    if s.ai_provider == "mistral":
        return f"Mistral API ({s.ai_model})"
    if s.ai_provider == "self-hosted":
        return f"self-hosted vLLM ({s.ai_base_url})"
    if s.ai_provider == "deepseek-api":
        return "DeepSeek API"
    return "Anthropic API"
