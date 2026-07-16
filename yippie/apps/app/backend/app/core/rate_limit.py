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
    """Return the real client IP.

    Proxy chain: Client → Railway edge → nginx → FastAPI.
    nginx appends $remote_addr (the Railway internal IP) via $proxy_add_x_forwarded_for,
    so the XFF list arriving at FastAPI is: [client_ip, railway_edge_ip].
    The second-to-last entry is the actual visitor; the last is Railway's own IP and
    cannot be used to key rate limiters (all visitors would share one bucket).
    With a single entry (local dev, no Railway in front) the single entry is used.
    cf-connecting-ip and x-real-ip are deliberately NOT consulted: any client can
    set those headers and mint fresh rate-limit buckets per request.
    """
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        parts = [p.strip() for p in xff.split(",") if p.strip()]
        # Two trusted hops (Railway + nginx): real client is second-to-last.
        client_ip = parts[-2] if len(parts) >= 2 else parts[-1]
        if client_ip:
            return client_ip
    return (request.client.host if request.client else None) or "unknown"

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

# Bound the fallback store: without this, one unique key per client IP
# accumulates forever when Redis is down. 3600s is the longest window any
# caller uses, so entries idle longer than that are always expired.
_FALLBACK_MAX_KEYS = 10_000
_FALLBACK_MAX_IDLE = 3600


def _prune_fallback() -> None:
    if len(_fallback) < _FALLBACK_MAX_KEYS:
        return
    now = time.monotonic()
    stale = [k for k, hits in _fallback.items() if not hits or now - hits[-1] > _FALLBACK_MAX_IDLE]
    for k in stale:
        del _fallback[k]
    if len(_fallback) >= _FALLBACK_MAX_KEYS:
        # Still over cap (active flood of unique keys): evict the oldest half.
        # Being lenient on rate limits beats unbounded memory growth.
        excess = sorted(_fallback, key=lambda k: _fallback[k][-1])[: len(_fallback) // 2]
        for k in excess:
            del _fallback[k]


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
    _prune_fallback()
    now = time.monotonic()
    _fallback[key].append(now)
