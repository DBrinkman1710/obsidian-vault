"""Distributed lock for APScheduler jobs via Redis SETNX.

Prevents duplicate runs when multiple container instances are running
(e.g. during rolling deploys or if Railway scales horizontally).

Usage — add these two lines at the top of each scheduled job function:
    if await skip_if_locked("job_name", ttl=270):
        return

Set ttl slightly below the job interval so the lock expires before the
next tick and the next instance can always acquire it:
    5-min job  → ttl=270
    15-min job → ttl=870
    1-hour job → ttl=3300
    24-hr job  → ttl=82800

Falls back to always-run (returns False) when Redis is not configured.
The lock is NOT explicitly released — it expires via TTL. This is
correct because ttl < interval guarantees the lock is gone before the
next tick, and it avoids complexity around early-return / exception paths.
"""
from __future__ import annotations

import logging

log = logging.getLogger(__name__)

_KEY_PREFIX = "yippie:scheduler:"


def _get_redis():
    try:
        from app.core.rate_limit import _redis
        return _redis()
    except Exception:
        return None


async def skip_if_locked(name: str, ttl: int) -> bool:
    """Try to acquire a Redis NX lock for this job.

    Returns True  → another instance holds the lock; caller should return early.
    Returns False → lock acquired (or Redis unavailable); caller should proceed.

    The lock expires after *ttl* seconds automatically — no explicit release.
    """
    r = _get_redis()
    if r is None:
        return False

    key = f"{_KEY_PREFIX}{name}"
    try:
        acquired = bool(await r.set(key, "1", nx=True, ex=ttl))
        if not acquired:
            log.debug("skip_if_locked: %s skipped — lock held by another instance", name)
        return not acquired
    except Exception:
        log.warning(
            "skip_if_locked: Redis check failed for %s — running without lock",
            name,
            exc_info=True,
        )
        return False
