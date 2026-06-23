from __future__ import annotations

import litellm

from app.config import get_settings

litellm.suppress_debug_info = True


def _check_provider_config(s) -> None:
    """Raise a clear error if the required credentials for the active provider are missing."""
    if s.ai_provider == "self-hosted" and not s.ai_base_url:
        raise ValueError(
            "AI_PROVIDER=self-hosted requires AI_BASE_URL to be set "
            "(e.g. http://your-droplet:8000/v1)"
        )
    if s.ai_provider == "deepseek-api" and not s.deepseek_api_key:
        raise ValueError(
            "AI_PROVIDER=deepseek-api requires DEEPSEEK_API_KEY to be set"
        )
    if s.ai_provider == "anthropic" and not s.anthropic_api_key:
        raise ValueError(
            "AI_PROVIDER=anthropic requires ANTHROPIC_API_KEY to be set"
        )


async def ai_completion(messages: list[dict], *, max_tokens: int = 512) -> str:
    """Call the configured AI provider. Returns the text content of the response.

    Provider is controlled by AI_PROVIDER env var:
      "anthropic"    — Anthropic API (default; uses ANTHROPIC_API_KEY)
      "deepseek-api" — DeepSeek API  (uses DEEPSEEK_API_KEY; set AI_MODEL=deepseek-chat)
      "self-hosted"  — OpenAI-compatible endpoint (uses AI_BASE_URL; set AI_MODEL=<model-name>)
    """
    s = get_settings()
    _check_provider_config(s)

    if s.ai_provider == "self-hosted":
        resp = await litellm.acompletion(
            model=f"openai/{s.ai_model}",
            base_url=s.ai_base_url,
            api_key="local",
            messages=messages,
            max_tokens=max_tokens,
        )
    elif s.ai_provider == "deepseek-api":
        resp = await litellm.acompletion(
            model=f"deepseek/{s.ai_model}",
            api_key=s.deepseek_api_key,
            messages=messages,
            max_tokens=max_tokens,
        )
    else:
        resp = await litellm.acompletion(
            model=f"anthropic/{s.ai_model}",
            api_key=s.anthropic_api_key,
            messages=messages,
            max_tokens=max_tokens,
        )

    return (resp.choices[0].message.content or "").strip()


def active_provider_label() -> str:
    """Human-readable label for the currently active AI provider (for status endpoints)."""
    s = get_settings()
    if s.ai_provider == "self-hosted":
        return f"self-hosted ({s.ai_base_url})"
    if s.ai_provider == "deepseek-api":
        return "DeepSeek API"
    return "Anthropic API"
