"""[YIP-KB] retrieval — keyword overlap selection of kb_chunks for a message.

Deliberately dependency-free (no vector DB, no embeddings) for v1: a lowercase
word-overlap score over chunk content vs. the incoming message, with a bonus for
heading hits. Capped at MAX_CHUNKS / TOKEN_BUDGET so the prompt stays bounded.
"""
from __future__ import annotations

import re
import uuid
from typing import Optional, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.knowledge.models import KbChunk, KbSource

MAX_CHUNKS = 3
TOKEN_BUDGET = 1500

# Tiny EN + NL stopword list — just enough that "how do I ..." style questions
# don't match every chunk equally.
_STOPWORDS = frozenset(
    """a an and are as at be but by can do does for from has have how i if in is it my of on or our
    so that the this to was we what when where which who why will with you your
    aan als bij dan dat de den der die dit een en er heb het hoe ik in is je kan
    maar met mijn naar niet of om onze ook op te van voor waar wat wij wordt zijn""".split()
)

_WORD_RE = re.compile(r"[a-z0-9]{2,}")


def _tokens(text: str) -> set[str]:
    return {w for w in _WORD_RE.findall(text.lower()) if w not in _STOPWORDS}


def score_chunk(query_tokens: set[str], chunk) -> int:
    """Overlap count on content, heading hits count double."""
    if not query_tokens:
        return 0
    score = len(query_tokens & _tokens(chunk.content))
    if chunk.heading:
        score += 2 * len(query_tokens & _tokens(chunk.heading))
    return score


def select_chunks(
    chunks: Sequence,
    query: str,
    max_chunks: int = MAX_CHUNKS,
    token_budget: int = TOKEN_BUDGET,
) -> list:
    """Top-K chunks by keyword overlap, bounded by count and token budget."""
    query_tokens = _tokens(query)
    scored = [(score_chunk(query_tokens, c), i, c) for i, c in enumerate(chunks)]
    # Zero-score chunks are noise, not knowledge — never inject them.
    scored = [s for s in scored if s[0] > 0]
    scored.sort(key=lambda s: (-s[0], s[1]))  # stable: score desc, document order

    selected: list = []
    used_tokens = 0
    for _, _, chunk in scored:
        if len(selected) >= max_chunks:
            break
        if used_tokens + chunk.token_estimate > token_budget and selected:
            continue
        selected.append(chunk)
        used_tokens += chunk.token_estimate
    return selected


def chunk_query(tenant_id: uuid.UUID, source_id: uuid.UUID):
    """The tenant-scoped chunk select — kept as a function so tests can assert
    the tenant filter is always present (RLS is the second layer, not the only one)."""
    return (
        select(KbChunk)
        .where(KbChunk.tenant_id == tenant_id, KbChunk.source_id == source_id)
        .order_by(KbChunk.created_at.asc())
    )


async def build_kb_block(db: AsyncSession, tenant_id: uuid.UUID, query_text: str) -> Optional[str]:
    """Render the "Company knowledge" prompt block for this tenant, or None.

    None when the tenant has no fetched source or nothing relevant matches —
    the caller then behaves exactly as before [YIP-KB] (graceful no-op).
    """
    source = await db.scalar(
        select(KbSource).where(KbSource.tenant_id == tenant_id, KbSource.status == "ok")
    )
    if source is None:
        return None
    result = await db.execute(chunk_query(tenant_id, source.id))
    chunks = result.scalars().all()
    selected = select_chunks(chunks, query_text)
    if not selected:
        return None
    parts = []
    for chunk in selected:
        if chunk.heading and not chunk.content.startswith(chunk.heading):
            parts.append(f"{chunk.heading}\n{chunk.content}")
        else:
            parts.append(chunk.content)
    return "\n\n---\n\n".join(parts)
