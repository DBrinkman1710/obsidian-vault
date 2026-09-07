"""[YIP-KB] HTML → readable sections → bounded chunks.

Pure logic, no I/O — the fetch lives in service.py so tests can feed a fixture
HTML string straight into extract_sections/chunk_sections.
"""
from __future__ import annotations

from dataclasses import dataclass

from bs4 import BeautifulSoup

# Boilerplate that never belongs in a knowledge chunk.
_STRIP_TAGS = ("script", "style", "nav", "footer", "header", "aside", "noscript", "form", "iframe", "svg", "button", "select")
# Headings start a new section; <summary> covers <details> FAQ accordions.
_HEADING_TAGS = ("h1", "h2", "h3", "h4", "h5", "h6", "summary")
# Block elements whose text we collect (nested matches are skipped — the
# outermost one already carries the full text via get_text()).
_BLOCK_TAGS = ("p", "li", "td", "th", "dt", "dd", "blockquote", "pre")

# ~4 chars per token is close enough for budget bookkeeping (v1, no tokenizer dep).
CHUNK_TARGET_TOKENS = 650
CHUNK_MAX_TOKENS = 800


@dataclass
class ChunkDraft:
    heading: str | None
    content: str
    token_estimate: int


def estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


def extract_sections(html: str) -> list[tuple[str | None, str]]:
    """Strip boilerplate and return (heading, text) sections in document order.

    Splitting on headings keeps Q&A pairs together — on a typical FAQ page each
    question is a heading and its answer the following paragraphs.
    """
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup.find_all(_STRIP_TAGS):
        tag.decompose()
    root = soup.body or soup

    sections: list[tuple[str | None, str]] = []
    heading: str | None = None
    buf: list[str] = []

    def flush() -> None:
        text = "\n".join(buf).strip()
        if text or heading:
            sections.append((heading, text))

    for el in root.find_all(list(_HEADING_TAGS) + list(_BLOCK_TAGS)):
        if el.find_parent(_BLOCK_TAGS):
            continue  # nested block — the outer element's get_text already has it
        text = el.get_text(" ", strip=True)
        if not text:
            continue
        if el.name in _HEADING_TAGS:
            flush()
            heading, buf = text, []
        else:
            buf.append(text)
    flush()

    # Drop heading-only sections with no body text (e.g. a page title directly
    # followed by another heading).
    sections = [(h, t) for h, t in sections if t]

    if not sections:
        # Page without block markup — fall back to the whole readable text.
        whole = root.get_text(" ", strip=True)
        if whole:
            return [(None, whole)]
    return sections


def _split_long(text: str, target_tokens: int) -> list[str]:
    """Split an oversized section on paragraph, then sentence boundaries."""
    parts: list[str] = []
    current = ""
    for para in text.split("\n"):
        candidate = f"{current}\n{para}".strip() if current else para
        if estimate_tokens(candidate) <= target_tokens:
            current = candidate
            continue
        if current:
            parts.append(current)
        if estimate_tokens(para) <= target_tokens:
            current = para
            continue
        # Single huge paragraph — split on sentences, hard-wrap as a last resort.
        current = ""
        sentence_buf = ""
        for sentence in para.replace(". ", ".\x00").split("\x00"):
            candidate = f"{sentence_buf} {sentence}".strip() if sentence_buf else sentence
            if estimate_tokens(candidate) <= target_tokens:
                sentence_buf = candidate
            else:
                if sentence_buf:
                    parts.append(sentence_buf)
                while estimate_tokens(sentence) > target_tokens:
                    cut = target_tokens * 4
                    parts.append(sentence[:cut])
                    sentence = sentence[cut:]
                sentence_buf = sentence
        if sentence_buf:
            current = sentence_buf
    if current:
        parts.append(current)
    return parts


def chunk_sections(
    sections: list[tuple[str | None, str]],
    target_tokens: int = CHUNK_TARGET_TOKENS,
    max_tokens: int = CHUNK_MAX_TOKENS,
) -> list[ChunkDraft]:
    """Merge small sections / split large ones into ~target_tokens chunks.

    Each section is rendered with its heading inline so the question wording of
    a Q&A pair stays inside the chunk content for keyword retrieval; the chunk's
    `heading` column keeps the first heading for display and scoring bonus.
    """
    pieces: list[tuple[str | None, str]] = []
    for heading, text in sections:
        rendered = f"{heading}\n{text}".strip() if heading else text.strip()
        if estimate_tokens(rendered) > max_tokens:
            pieces += [(heading, part) for part in _split_long(rendered, target_tokens)]
        else:
            pieces.append((heading, rendered))

    chunks: list[ChunkDraft] = []
    cur_heading: str | None = None
    cur_parts: list[str] = []
    cur_tokens = 0

    def flush() -> None:
        if cur_parts:
            content = "\n\n".join(cur_parts)
            chunks.append(ChunkDraft(heading=cur_heading, content=content, token_estimate=estimate_tokens(content)))

    for heading, rendered in pieces:
        tokens = estimate_tokens(rendered)
        if cur_parts and cur_tokens + tokens > target_tokens:
            flush()
            cur_heading, cur_parts, cur_tokens = None, [], 0
        if not cur_parts:
            cur_heading = heading
        cur_parts.append(rendered)
        cur_tokens += tokens
    flush()
    return chunks
