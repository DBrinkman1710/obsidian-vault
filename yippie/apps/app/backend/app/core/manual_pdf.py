"""Renders user_manual.md to a PDF using fpdf2."""
from __future__ import annotations

import re
from pathlib import Path

from fpdf import FPDF

_MANUAL_PATH = Path(__file__).parent.parent.parent / "user_manual.md"

BRAND = (91, 164, 245)   # #5BA4F5
DARK  = (25, 35, 55)
BODY  = (50, 55, 65)
MUTED = (110, 120, 140)


def _normalize(text: str) -> str:
    return (
        text
        .replace("—", "--")
        .replace("–", "-")
        .replace("“", '"')
        .replace("”", '"')
        .replace("‘", "'")
        .replace("’", "'")
        .replace("•", "-")
        .replace("…", "...")
        .replace("·", "-")
        .replace("→", "->")
        .replace("←", "<-")
    )


def _strip_inline(text: str) -> str:
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)   # links
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)          # bold
    text = re.sub(r"\*([^*]+)\*", r"\1", text)              # italic
    text = re.sub(r"`([^`]+)`", r"\1", text)                # inline code
    return _normalize(text.strip())


def generate_manual_pdf() -> bytes:
    if not _MANUAL_PATH.exists():
        return b""

    lines = _MANUAL_PATH.read_text(encoding="utf-8").splitlines()

    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_margins(left=20, top=20, right=20)
    pdf.set_auto_page_break(auto=True, margin=22)
    pdf.add_page()

    W = 170   # usable width (210 - 2 x 20)

    in_code = False
    i = 0
    while i < len(lines):
        raw = lines[i]
        stripped = raw.strip()

        # ── code fence ──────────────────────────────────────────────────────────
        if stripped.startswith("```"):
            in_code = not in_code
            if in_code:
                pdf.ln(2)
            else:
                pdf.ln(2)
            i += 1
            continue

        if in_code:
            pdf.set_font("Courier", size=7.5)
            pdf.set_text_color(*MUTED)
            pdf.set_x(24)
            clean = _normalize(raw.expandtabs(4))
            pdf.multi_cell(W - 4, 4, clean if clean else " ")
            i += 1
            continue

        # ── blank line ──────────────────────────────────────────────────────────
        if not stripped:
            pdf.ln(2.5)
            i += 1
            continue

        # ── horizontal rule ─────────────────────────────────────────────────────
        if re.match(r"^-{3,}\s*$", stripped):
            pdf.ln(2)
            pdf.set_draw_color(210, 215, 225)
            pdf.line(20, pdf.get_y(), 190, pdf.get_y())
            pdf.ln(4)
            i += 1
            continue

        # ── H1 ──────────────────────────────────────────────────────────────────
        if stripped.startswith("# ") and not stripped.startswith("## "):
            text = _strip_inline(stripped[2:])
            pdf.set_font("Helvetica", "B", 17)
            pdf.set_text_color(*BRAND)
            pdf.multi_cell(W, 8, text)
            pdf.ln(1)
            i += 1
            continue

        # ── H2 ──────────────────────────────────────────────────────────────────
        if stripped.startswith("## ") and not stripped.startswith("### "):
            text = _strip_inline(stripped[3:])
            pdf.ln(3)
            pdf.set_font("Helvetica", "B", 12)
            pdf.set_text_color(*DARK)
            pdf.multi_cell(W, 7, text)
            y = pdf.get_y()
            pdf.set_draw_color(*BRAND)
            pdf.line(20, y, 65, y)
            pdf.ln(3)
            i += 1
            continue

        # ── H3 ──────────────────────────────────────────────────────────────────
        if stripped.startswith("### ") and not stripped.startswith("#### "):
            text = _strip_inline(stripped[4:])
            pdf.ln(2)
            pdf.set_font("Helvetica", "B", 10)
            pdf.set_text_color(45, 60, 90)
            pdf.multi_cell(W, 6, text)
            pdf.ln(1)
            i += 1
            continue

        # ── H4 ──────────────────────────────────────────────────────────────────
        if stripped.startswith("#### "):
            text = _strip_inline(stripped[5:])
            pdf.ln(1)
            pdf.set_font("Helvetica", "B", 9)
            pdf.set_text_color(*BODY)
            pdf.multi_cell(W, 5.5, text)
            i += 1
            continue

        # ── blockquote ──────────────────────────────────────────────────────────
        if stripped.startswith("> "):
            text = _strip_inline(stripped[2:])
            pdf.set_font("Helvetica", "I", 8.5)
            pdf.set_text_color(*MUTED)
            old_l = pdf.l_margin
            pdf.set_left_margin(26)
            pdf.set_x(26)
            pdf.multi_cell(W - 6, 5, text)
            pdf.set_left_margin(old_l)
            pdf.ln(1)
            i += 1
            continue

        # ── numbered list item ───────────────────────────────────────────────────
        m = re.match(r"^(\d+)\.\s+(.*)", stripped)
        if m:
            num, text = m.group(1), _strip_inline(m.group(2))
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(*BODY)
            old_l = pdf.l_margin
            pdf.set_left_margin(30)
            pdf.set_x(24)
            pdf.cell(6, 5, f"{num}.", ln=0)
            pdf.multi_cell(W - 10, 5, text)
            pdf.set_left_margin(old_l)
            i += 1
            continue

        # ── sub-bullet (2 or 4 spaces indent) ───────────────────────────────────
        if re.match(r"^ {2,4}[-*]\s", raw):
            text = _strip_inline(re.sub(r"^ {2,4}[-*]\s+", "", raw))
            pdf.set_font("Helvetica", "", 8.5)
            pdf.set_text_color(*MUTED)
            old_l = pdf.l_margin
            pdf.set_left_margin(32)
            pdf.set_x(28)
            pdf.cell(4, 5, "-", ln=0)
            pdf.multi_cell(W - 12, 5, text)
            pdf.set_left_margin(old_l)
            i += 1
            continue

        # ── top-level bullet ─────────────────────────────────────────────────────
        if stripped.startswith("- ") or stripped.startswith("* "):
            text = _strip_inline(stripped[2:])
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(*BODY)
            old_l = pdf.l_margin
            pdf.set_left_margin(26)
            pdf.set_x(22)
            pdf.cell(4, 5, "-", ln=0)
            pdf.multi_cell(W - 6, 5, text)
            pdf.set_left_margin(old_l)
            i += 1
            continue

        # ── regular paragraph ────────────────────────────────────────────────────
        text = _strip_inline(stripped)
        if text:
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(*BODY)
            pdf.multi_cell(W, 5, text)

        i += 1

    # ── footer on every page ─────────────────────────────────────────────────────
    pdf.set_y(-15)
    pdf.set_font("Helvetica", "", 7)
    pdf.set_text_color(*MUTED)
    pdf.cell(W, 5, "Yippie Platform Manual  -  app.getyippie.com", align="C")

    return bytes(pdf.output())
