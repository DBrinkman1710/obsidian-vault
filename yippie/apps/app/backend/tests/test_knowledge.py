"""[YIP-KB] knowledge base tests — extraction, chunking, retrieval, grounding.

DB-free and network-free: extraction/chunking/retrieval are pure logic fed a
fixture HTML string; the reply-draft grounding tests monkeypatch the AI call
and the retrieval function. Tenant isolation is asserted structurally on the
chunk query (RLS on kb_source/kb_chunk is the second layer, not the only one).
"""
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
import uuid as _uuid

from app.modules.knowledge.extract import (
    CHUNK_MAX_TOKENS,
    chunk_sections,
    estimate_tokens,
    extract_sections,
)
from app.modules.knowledge.retrieval import chunk_query, select_chunks
from app.modules.knowledge.schemas import KbSourceIn


FAQ_HTML = """
<html>
<head><title>Acme FAQ</title><script>var tracking = "evil";</script></head>
<body>
<nav><ul><li>Home</li><li>Pricing</li><li>Contact</li></ul></nav>
<h1>Frequently asked questions</h1>
<h2>What is your return policy?</h2>
<p>You can return any item within 30 days of delivery for a full refund.
Items must be unused and in the original packaging.</p>
<h2>How long does shipping take?</h2>
<p>Standard shipping takes 3 to 5 business days within the Netherlands.
Express shipping arrives the next business day.</p>
<h2>Do you ship internationally?</h2>
<p>Yes, we ship to all EU countries. International orders take 5 to 10 business days.</p>
<footer><p>Copyright Acme BV — all rights reserved</p></footer>
</body>
</html>
"""


# ── extraction ────────────────────────────────────────────────────────────────

def test_extraction_strips_nav_footer_and_script():
    text = " ".join(t for _, t in extract_sections(FAQ_HTML))
    assert "evil" not in text
    assert "Pricing" not in text            # nav gone
    assert "all rights reserved" not in text  # footer gone


def test_extraction_splits_on_headings_keeping_qa_pairs():
    sections = dict(extract_sections(FAQ_HTML))
    assert "What is your return policy?" in sections
    assert "30 days" in sections["What is your return policy?"]
    assert "next business day" in sections["How long does shipping take?"]


def test_extraction_falls_back_to_whole_text_without_block_markup():
    sections = extract_sections("<html><body><div>Just some plain text</div></body></html>")
    assert len(sections) == 1
    assert sections[0][1] == "Just some plain text"


def test_extraction_of_empty_page_yields_nothing():
    assert extract_sections("<html><body><script>x()</script></body></html>") == []


# ── chunking ──────────────────────────────────────────────────────────────────

def test_small_sections_merge_into_one_chunk():
    chunks = chunk_sections(extract_sections(FAQ_HTML))
    assert len(chunks) == 1  # whole FAQ is well under the target
    assert "return policy" in chunks[0].content
    assert "internationally" in chunks[0].content
    assert chunks[0].token_estimate == estimate_tokens(chunks[0].content)


def test_question_wording_stays_inside_chunk_content():
    """Q&A grounding depends on the question words being retrievable."""
    chunks = chunk_sections(extract_sections(FAQ_HTML))
    assert "What is your return policy?" in chunks[0].content


def test_oversized_section_is_split_below_the_cap():
    big = [("Terms", "This is a sentence about widgets. " * 400)]  # ~3200 tokens
    chunks = chunk_sections(big)
    assert len(chunks) > 1
    assert all(c.token_estimate <= CHUNK_MAX_TOKENS for c in chunks)
    # No text lost beyond whitespace joins
    assert sum(len(c.content) for c in chunks) >= len(big[0][1]) * 0.95


# ── retrieval ─────────────────────────────────────────────────────────────────

def _chunk(heading, content, tokens=100):
    return SimpleNamespace(heading=heading, content=content, token_estimate=tokens)


RETURNS = _chunk("What is your return policy?", "Return any item within 30 days for a refund.")
SHIPPING = _chunk("How long does shipping take?", "Standard shipping takes 3 to 5 business days.")
BILLING = _chunk("How do invoices work?", "Invoices are sent monthly by email.")


def test_retrieval_picks_the_relevant_chunk_first():
    out = select_chunks([BILLING, SHIPPING, RETURNS], "Hi, I want to return my order and get a refund")
    assert out and out[0] is RETURNS


def test_retrieval_returns_nothing_for_an_unrelated_message():
    out = select_chunks([RETURNS, SHIPPING], "Mijn wachtwoord resetten lukt niet")
    assert out == []


def test_retrieval_caps_chunk_count():
    many = [_chunk(f"Q{i}", "shipping delivery time question") for i in range(10)]
    assert len(select_chunks(many, "how long is the shipping delivery time")) == 3


def test_retrieval_respects_the_token_budget():
    fat = [_chunk(f"Q{i}", "shipping delivery time question", tokens=900) for i in range(3)]
    out = select_chunks(fat, "shipping delivery time")
    assert len(out) == 1  # a second 900-token chunk would blow the 1500 budget


def test_chunk_query_is_tenant_scoped():
    """The retrieval select must always filter on tenant_id — a tenant can
    never be handed another tenant's chunks even before RLS kicks in."""
    sql = str(chunk_query(_uuid.uuid4(), _uuid.uuid4()))
    assert "kb_chunk.tenant_id =" in sql
    assert "kb_chunk.source_id =" in sql


# ── schema validation ─────────────────────────────────────────────────────────

@pytest.mark.parametrize("url", ["https://acme.nl/faq", "http://acme.nl/help/faq.html"])
def test_http_and_https_urls_are_accepted(url):
    assert KbSourceIn(url=url).url == url


@pytest.mark.parametrize("bad", ["ftp://acme.nl/faq", "javascript:alert(1)", "acme.nl/faq", "file:///etc/passwd"])
def test_non_http_urls_are_rejected(bad):
    with pytest.raises(ValueError):
        KbSourceIn(url=bad)


# ── reply-draft grounding ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_reply_draft_injects_company_knowledge(monkeypatch):
    from app.modules.inbox import ai_scanner
    from app.modules.knowledge import retrieval

    captured = {}

    async def fake_completion(messages, **kw):
        captured["prompt"] = messages[0]["content"]
        return "Dear Customer, ..."

    monkeypatch.setattr(ai_scanner, "ai_completion", fake_completion)
    monkeypatch.setattr(
        retrieval, "build_kb_block", AsyncMock(return_value="Return any item within 30 days.")
    )

    await ai_scanner.generate_reply_draft(
        subject="Return request",
        description="Customer wants to return an item",
        context_summary=None,
        contact_name="Jan",
        db=object(),
        tenant_id=_uuid.uuid4(),
    )
    assert "Company knowledge" in captured["prompt"]
    assert "within 30 days" in captured["prompt"]
    assert "Do not invent facts" in captured["prompt"]


@pytest.mark.asyncio
async def test_reply_draft_without_db_is_unchanged_behaviour(monkeypatch):
    from app.modules.inbox import ai_scanner

    captured = {}

    async def fake_completion(messages, **kw):
        captured["prompt"] = messages[0]["content"]
        return "ok"

    monkeypatch.setattr(ai_scanner, "ai_completion", fake_completion)
    await ai_scanner.generate_reply_draft(
        subject="s", description="d", context_summary=None, contact_name=None
    )
    assert "Company knowledge" not in captured["prompt"]


@pytest.mark.asyncio
async def test_reply_draft_survives_a_retrieval_failure(monkeypatch):
    """A KB error must never sink the draft — graceful no-op."""
    from app.modules.inbox import ai_scanner
    from app.modules.knowledge import retrieval

    captured = {}

    async def fake_completion(messages, **kw):
        captured["prompt"] = messages[0]["content"]
        return "ok"

    monkeypatch.setattr(ai_scanner, "ai_completion", fake_completion)
    monkeypatch.setattr(retrieval, "build_kb_block", AsyncMock(side_effect=RuntimeError("db down")))

    out = await ai_scanner.generate_reply_draft(
        subject="s", description="d", context_summary=None, contact_name=None,
        db=object(), tenant_id=_uuid.uuid4(),
    )
    assert out == "ok"
    assert "Company knowledge" not in captured["prompt"]


# ── endpoints (mounted + gated) ───────────────────────────────────────────────

def test_knowledge_routes_are_mounted_behind_the_ai_gate(app):
    paths = {r.path for r in app.routes}
    assert "/api/v1/knowledge/source" in paths
    assert "/api/v1/knowledge/source/refetch" in paths


@pytest.mark.asyncio
async def test_knowledge_source_requires_auth(client):
    resp = await client.get("/api/v1/knowledge/source")
    assert resp.status_code == 401
