"""Redis-backed sliding-window rate limiter.

Falls back silently to in-memory state when Redis is unavailable, so
an outage never takes down auth. Keys use sorted sets: score = timestamp,
member = str(timestamp) (unique enough for our sub-second precision).
"""
from __future__ import annotations

import time
from collections import defaultdict
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from fastapi import Request


def get_client_ip(request: "Request") -> str:
    """Return the real client IP, preferring CF-Connecting-IP over the socket peer."""
    return (
        request.headers.get("cf-connecting-ip")
        or request.headers.get("x-real-ip")
        or (request.client.host if request.client else None)
        or "unknown"
    )

_client = None


def _redis():
    global _client
    if _client is not None:
        return _client
    try:
        from app.config import get_settings
        url = get_settings().redis_url
        if not url:
            return None
        import redis.asyncio as aioredis
        _client = aioredis.from_url(url, decode_responses=True)
    except Exception:
        pass
    return _client


# In-memory fallback when Redis is not configured or unavailable.
_fallback: dict[str, list[float]] = defaultdict(list)


async def rl_is_blocked(key: str, limit: int, window: int) -> bool:
    """Return True if the current attempt count for *key* is at or above *limit*.
    Does NOT record a new attempt — call rl_hit() separately for that."""
    r = _redis()
    if r is not None:
        try:
            now = time.time()
            count = await r.zcount(key, now - window, "+inf")
            return int(count) >= limit
        except Exception:
            pass
    # Fallback: count in-memory hits in the window
    now = time.monotonic()
    hits = [t for t in _fallback[key] if now - t < window]
    _fallback[key] = hits
    return len(hits) >= limit


async def rl_hit(key: str, window: int) -> None:
    """Record one attempt against *key*. Expires automatically after *window* seconds."""
    r = _redis()
    if r is not None:
        try:
            now = time.time()
            pipe = r.pipeline()
            pipe.zadd(key, {str(now): now})
            pipe.zremrangebyscore(key, 0, now - window)
            pipe.expire(key, window + 1)
            await pipe.execute()
            return
        except Exception:
            pass
    now = time.monotonic()
    _fallback[key].append(now)
