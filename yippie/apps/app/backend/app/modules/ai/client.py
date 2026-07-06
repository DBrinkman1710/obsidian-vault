from __future__ import annotations

import litellm

from app.config import get_settings

litellm.suppress_debug_info = True


def _resolve_workload(s, workload: str) -> tuple[str, str]:
    """Map a workload to its (provider, model).

    "agent" — the Yip tool loop; overridable via AI_AGENT_PROVIDER / AI_AGENT_MODEL
    so the agent can run on a premium tool-calling model while high-volume work
    (inbox scanning, marketing replies) stays on the cheap default provider.
    Empty overrides fall back to AI_PROVIDER / AI_MODEL.
    """
    if workload == "agent" and s.ai_agent_provider:
        return s.ai_agent_provider, (s.ai_agent_model or s.ai_model)
    return s.ai_provider, s.ai_model


def _check_provider_config(s, provider: str) -> None:
    """Raise a clear error if the required credentials for the provider are missing."""
    if provider == "mistral" and not s.mistral_api_key:
        raise ValueError(
            "AI provider mistral requires MISTRAL_API_KEY to be set. "
            "Get a key at console.mistral.ai (EU-hosted, GDPR-safe)."
        )
    if provider == "self-hosted" and not s.ai_base_url:
        raise ValueError(
            "AI provider self-hosted requires AI_BASE_URL to be set "
            "(e.g. http://your-hetzner-server:8000/v1)"
        )
    if provider == "deepseek-api" and not s.deepseek_api_key:
        raise ValueError(
            "AI provider deepseek-api requires DEEPSEEK_API_KEY to be set"
        )
    if provider == "anthropic" and not s.anthropic_api_key:
        raise ValueError(
            "AI provider anthropic requires ANTHROPIC_API_KEY to be set"
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


async def _acompletion(messages: list[dict], *, max_tokens: int, workload: str = "default", **extra):
    """Dispatch a completion to the provider resolved for this workload.

    Default provider is controlled by AI_PROVIDER env var:
      "mistral"      — Mistral API (default; EU-hosted, GDPR-safe; uses MISTRAL_API_KEY)
      "anthropic"    — Anthropic API (uses ANTHROPIC_API_KEY)
      "deepseek-api" — DeepSeek API (uses DEEPSEEK_API_KEY; set AI_MODEL=deepseek-chat)
      "self-hosted"  — OpenAI-compatible endpoint (uses AI_BASE_URL; target: vLLM on Hetzner)
    The "agent" workload can override via AI_AGENT_PROVIDER / AI_AGENT_MODEL.
    """
    s = get_settings()
    provider, model = _resolve_workload(s, workload)
    _check_provider_config(s, provider)

    if provider == "mistral":
        return await litellm.acompletion(
            model=f"mistral/{model}",
            api_key=s.mistral_api_key,
            messages=messages,
            max_tokens=max_tokens,
            **extra,
        )
    if provider == "self-hosted":
        return await litellm.acompletion(
            model=f"openai/{model}",
            base_url=s.ai_base_url,
            api_key="local",
            messages=messages,
            max_tokens=max_tokens,
            **extra,
        )
    if provider == "deepseek-api":
        return await litellm.acompletion(
            model=f"deepseek/{model}",
            api_key=s.deepseek_api_key,
            messages=messages,
            max_tokens=max_tokens,
            **extra,
        )
    return await litellm.acompletion(
        model=f"anthropic/{model}",
        api_key=s.anthropic_api_key,
        messages=_apply_prompt_caching(messages),
        max_tokens=max_tokens,
        **extra,
    )


async def ai_completion(messages: list[dict], *, max_tokens: int = 512, workload: str = "default") -> str:
    """Call the AI provider for this workload. Returns the text content of the response."""
    resp = await _acompletion(messages, max_tokens=max_tokens, workload=workload)
    return (resp.choices[0].message.content or "").strip()


async def ai_completion_tools(
    messages: list[dict], *, tools: list[dict], max_tokens: int = 1024, workload: str = "agent"
):
    """Tool-calling completion. Returns the full assistant message (content + tool_calls).

    `tools` uses the OpenAI function-calling schema; litellm translates it for
    every provider (Anthropic tool_use blocks, Mistral function calling, etc.).
    Defaults to the "agent" workload so AI_AGENT_PROVIDER routing applies.
    """
    resp = await _acompletion(messages, max_tokens=max_tokens, workload=workload, tools=tools, tool_choice="auto")
    return resp.choices[0].message


async def ai_stream_tools(
    messages: list[dict], *, tools: list[dict], max_tokens: int = 1024, workload: str = "agent"
):
    """[YIP-STREAM] Streaming tool-calling completion — returns the litellm chunk stream.

    Callers iterate the chunks (forwarding content deltas) and reconstruct the
    full message with litellm.stream_chunk_builder afterwards.
    """
    return await _acompletion(
        messages, max_tokens=max_tokens, workload=workload, tools=tools, tool_choice="auto", stream=True
    )


def active_provider_label() -> str:
    """Human-readable label for the currently active AI provider (for status endpoints)."""
    s = get_settings()
    if s.ai_provider == "mistral":
        label = f"Mistral API ({s.ai_model})"
    elif s.ai_provider == "self-hosted":
        label = f"self-hosted vLLM ({s.ai_base_url})"
    elif s.ai_provider == "deepseek-api":
        label = "DeepSeek API"
    else:
        label = "Anthropic API"
    if s.ai_agent_provider:
        label += f" · agent: {s.ai_agent_provider} ({s.ai_agent_model or s.ai_model})"
    return label
