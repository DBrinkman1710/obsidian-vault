"""[YIP-KB] ingestion service — fetch the tenant's FAQ page, chunk it, store it."""
from __future__ import annotations

import asyncio
import ipaddress
import logging
import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse

import httpx
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import db_session, set_tenant_context
from app.modules.knowledge.extract import chunk_sections, extract_sections
from app.modules.knowledge.models import KbChunk, KbSource
from app.modules.knowledge.schemas import KbSourceOut

log = logging.getLogger(__name__)

MAX_PAGE_BYTES = 2_000_000  # refuse oversized pages — a FAQ page is not 2 MB
MAX_CHUNKS = 200
FETCH_TIMEOUT = 15.0
_USER_AGENT = "YippieBot/1.0 (+https://getyippie.com)"


# ── reads ─────────────────────────────────────────────────────────────────────

async def get_source(db: AsyncSession, tenant_id: uuid.UUID) -> KbSource | None:
    return await db.scalar(select(KbSource).where(KbSource.tenant_id == tenant_id))


async def source_out(db: AsyncSession, tenant_id: uuid.UUID) -> KbSourceOut | None:
    source = await get_source(db, tenant_id)
    if source is None:
        return None
    chunk_count = await db.scalar(
        select(func.count()).select_from(KbChunk).where(
            KbChunk.tenant_id == tenant_id, KbChunk.source_id == source.id
        )
    )
    return KbSourceOut(
        id=source.id,
        url=source.url,
        status=source.status,
        last_fetched_at=source.last_fetched_at,
        error=source.error,
        char_count=source.char_count,
        chunk_count=int(chunk_count or 0),
        created_at=source.created_at,
    )


# ── writes ────────────────────────────────────────────────────────────────────

async def set_source(db: AsyncSession, tenant_id: uuid.UUID, url: str) -> KbSource:
    """Set or replace the tenant's single source; old chunks are dropped so a
    stale page never grounds a reply while the new fetch runs."""
    source = await get_source(db, tenant_id)
    if source is None:
        source = KbSource(tenant_id=tenant_id, url=url, status="pending")
        db.add(source)
        await db.flush()
    else:
        await db.execute(delete(KbChunk).where(KbChunk.tenant_id == tenant_id, KbChunk.source_id == source.id))
        source.url = url
        source.status = "pending"
        source.error = None
        source.char_count = 0
    return source


async def mark_pending(db: AsyncSession, source: KbSource) -> None:
    source.status = "pending"
    source.error = None


async def delete_source(db: AsyncSession, tenant_id: uuid.UUID) -> bool:
    source = await get_source(db, tenant_id)
    if source is None:
        return False
    # kb_chunk rows go with it via ON DELETE CASCADE.
    await db.delete(source)
    return True


# ── fetching (background task — owns its session, RLS context set) ────────────

async def _guard_public_host(hostname: str) -> None:
    """SSRF guard: the admin-supplied URL must not resolve to a private address
    (this runs server-side inside the platform's network)."""
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(hostname, None)
    except OSError:
        raise ValueError("Host could not be resolved")
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_unspecified:
            raise ValueError("URL host is not publicly reachable")


async def fetch_html(url: str) -> str:
    """Fetch the page with scheme/host/size/content-type guards."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("URL must start with http:// or https://")
    if not parsed.hostname:
        raise ValueError("URL has no host")
    await _guard_public_host(parsed.hostname)

    async with httpx.AsyncClient(
        follow_redirects=True, timeout=FETCH_TIMEOUT, headers={"User-Agent": _USER_AGENT}
    ) as client:
        async with client.stream("GET", url) as resp:
            resp.raise_for_status()
            if resp.url.scheme not in ("http", "https"):
                raise ValueError("Redirected to a non-http(s) URL")
            content_type = resp.headers.get("content-type", "")
            if content_type and "html" not in content_type and "text" not in content_type:
                raise ValueError(f"Not an HTML page (content-type: {content_type.split(';')[0]})")
            body = b""
            async for part in resp.aiter_bytes():
                body += part
                if len(body) > MAX_PAGE_BYTES:
                    raise ValueError("Page too large (over 2 MB)")
    return body.decode(resp.encoding or "utf-8", errors="replace")


async def fetch_source(tenant_id: uuid.UUID, source_id: uuid.UUID) -> None:
    """Background task entrypoint: crawl the source URL and store its chunks.

    Runs after the HTTP response, so it opens its own session and sets the
    tenant RLS context itself. Any failure lands in status='failed' + error —
    it must never raise out of a BackgroundTask.
    """
    async with db_session() as db:
        try:
            await set_tenant_context(db, tenant_id)
            source = await db.get(KbSource, source_id)
            if source is None:
                return
            try:
                html = await fetch_html(source.url)
                sections = extract_sections(html)
                drafts = chunk_sections(sections)[:MAX_CHUNKS]
                if not drafts:
                    raise ValueError("No readable text found on the page")
                await db.execute(
                    delete(KbChunk).where(KbChunk.tenant_id == tenant_id, KbChunk.source_id == source.id)
                )
                for draft in drafts:
                    db.add(
                        KbChunk(
                            tenant_id=tenant_id,
                            source_id=source.id,
                            heading=draft.heading,
                            content=draft.content,
                            token_estimate=draft.token_estimate,
                        )
                    )
                source.status = "ok"
                source.error = None
                source.char_count = sum(len(d.content) for d in drafts)
            except Exception as exc:  # network, parse, guard — all land on the row
                source.status = "failed"
                source.error = str(exc)[:500] or exc.__class__.__name__
            source.last_fetched_at = datetime.now(timezone.utc)
            await db.commit()
        except Exception:
            log.exception("[YIP-KB] fetch_source failed for source %s", source_id)
