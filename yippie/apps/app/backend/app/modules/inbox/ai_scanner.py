from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Optional

from app.modules.ai.client import ai_completion

LANGUAGE_NAMES = {
    "en": "English", "nl": "Dutch", "fr": "French", "de": "German",
    "es": "Spanish", "it": "Italian", "pt": "Portuguese", "pl": "Polish",
    "tr": "Turkish", "ar": "Arabic", "zh": "Chinese", "ja": "Japanese",
}


@dataclass
class AIScanResult:
    subject: str
    description: str
    priority: str
    category: Optional[str]
    language: str = field(default="en")


def _strip_fences(text: str) -> str:
    if text.startswith("```"):
        lines = text.split("\n")
        inner = "\n".join(lines[1:])
        return inner[:inner.rfind("```")].strip() if "```" in inner else inner.strip()
    return text


# Cap the body sent to the model to bound cost/latency on very large emails.
MAX_SCAN_BODY_CHARS = 8000


def _parse_json(text: str, fallback):
    """Parse model JSON output, returning ``fallback`` on any error."""
    try:
        return json.loads(_strip_fences(text))
    except (json.JSONDecodeError, ValueError, TypeError):
        return fallback


async def scan_message(sender: str, raw_body: str, source: str, tenant_profile: dict | None = None) -> AIScanResult:
    """Classify an inbound message and extract structured ticket fields."""
    common_terms = (tenant_profile or {}).get("common_terms", "")
    terms_line = f"\nWorkspace terminology: {common_terms}" if common_terms else ""

    prompt = f"""You are a customer service assistant. Analyze the following inbound {source} message and extract key information.

From: {sender}
Message:
{raw_body[:MAX_SCAN_BODY_CHARS]}

Respond with ONLY a JSON object (no markdown, no explanation) with these exact fields:
{{
  "subject": "concise ticket subject, max 80 chars",
  "description": "cleaned-up description of the issue or request",
  "priority": "low | medium | high | urgent",
  "category": "billing | technical | general | complaint | inquiry | null",
  "language": "ISO 639-1 code of the language the customer wrote in (e.g. en, nl, fr, de, es)"
}}

Priority guidance:
- urgent: system down, payment failed, legal threat
- high: blocking issue, unhappy customer, time-sensitive
- medium: normal request or question
- low: general inquiry, feedback{terms_line}"""

    text = await ai_completion([{"role": "user", "content": prompt}], max_tokens=512)
    data = _parse_json(text, fallback={})
    if not isinstance(data, dict):
        data = {}
    return AIScanResult(
        subject=data.get("subject", "New message"),
        description=data.get("description", raw_body[:1000]),
        priority=data.get("priority", "medium"),
        category=data.get("category") if data.get("category") != "null" else None,
        language=data.get("language", "en"),
    )


async def generate_context_summary(
    sender: str,
    raw_body: str,
    context: Optional[dict],
    tenant_profile: dict | None = None,
) -> str:
    """AI briefing keywords from the unified customer context (see
    app/core/customer_context.py — the canonical full-history aggregator)."""
    from app.core.customer_context import render_context_block

    business_desc = (tenant_profile or {}).get("business_description", "")
    business_line = f"\nBusiness context: {business_desc}" if business_desc else ""

    prompt = f"""You are a customer service briefing assistant. Produce a quick-scan briefing for an agent about to review an inbound message.{business_line}

INBOUND MESSAGE FROM: {sender}
---
{raw_body[:500]}
---

CUSTOMER HISTORY:
{render_context_block(context)}

Return 4-6 short keywords or phrases, comma-separated, capturing who this customer is and what matters most right now (e.g. "VIP customer, overdue invoice, 3rd complaint this month, prefers Dutch"). No full sentences, no bullet points, no labels — just the comma-separated list."""

    return await ai_completion([{"role": "user", "content": prompt}], max_tokens=80)


async def generate_reply_draft(
    subject: str,
    description: str,
    context_summary: Optional[str],
    contact_name: Optional[str],
    language: str = "en",
    tenant_profile: dict | None = None,
) -> str:
    lang_name = LANGUAGE_NAMES.get(language, "English")
    context_block = f"\n\nCustomer context: {context_summary}" if context_summary else ""
    greeting = f"Dear {contact_name}" if contact_name else "Dear Customer"
    sign_off = (tenant_profile or {}).get("sign_off", "Support Team") or "Support Team"
    tone = (tenant_profile or {}).get("tone", "professional")
    tone_line = f" Use a {tone} tone." if tone else ""

    prompt = f"""Write a professional, empathetic reply to this customer support request. Sign off as "{sign_off}". Max 200 words. Return plain text only, no JSON, no markdown.{tone_line}

IMPORTANT: The customer wrote in {lang_name}. Your entire reply MUST be written in {lang_name}.

Support request subject: {subject}
Issue: {description}{context_block}

Begin with: {greeting},"""

    return await ai_completion([{"role": "user", "content": prompt}], max_tokens=400)


async def generate_reply_improvements(
    current_text: str,
    context_summary: Optional[str],
    subject: str,
    language: str = "en",
    tenant_profile: dict | None = None,
) -> list[dict]:
    lang_name = LANGUAGE_NAMES.get(language, "English")
    context_block = f"\nCustomer context: {context_summary}" if context_summary else ""
    tone = (tenant_profile or {}).get("tone", "")
    tone_line = f"\nTarget tone: {tone}." if tone else ""

    prompt = f"""You are a customer service writing coach. Suggest up to 3 concrete improvements to this support reply. Return ONLY a JSON array, no other text.

IMPORTANT: All revised replies MUST be written in {lang_name}.{tone_line}

Subject: {subject}{context_block}

Current reply:
{current_text}

Return a JSON array of up to 3 objects:
[{{"label": "short description e.g. More empathetic tone", "revised_text": "complete rewrite of the reply in {lang_name}"}}]"""

    text = await ai_completion([{"role": "user", "content": prompt}], max_tokens=1200)
    parsed = _parse_json(text, fallback=[])
    return parsed[:3] if isinstance(parsed, list) else []


async def improve_compose_email(subject: str, body: str) -> dict:
    """Improve an existing compose email subject + body."""
    text = await ai_completion(
        [{
            "role": "user",
            "content": (
                "You are a professional writing assistant. Improve the clarity, tone, and professionalism "
                "of the email below. Keep the same intent and length — just make it better.\n\n"
                f"Subject: {subject}\n\nBody:\n{body}\n\n"
                "Return JSON only: {\"subject\": \"...\", \"body\": \"...\"}"
            ),
        }],
        max_tokens=512,
    )
    data = _parse_json(text, fallback=None)
    if isinstance(data, dict):
        return {"subject": data.get("subject", subject), "body": data.get("body", body)}
    return {"subject": subject, "body": text}


async def generate_compose_suggestion(prompt: str) -> dict:
    """Generate email subject + body from a plain-text brief."""
    text = await ai_completion(
        [{
            "role": "user",
            "content": (
                f"Write a professional customer service email based on this brief:\n\n{prompt}\n\n"
                "Return JSON only: {\"subject\": \"...\", \"body\": \"...\"}\n"
                "Keep the body concise and friendly. Sign off as 'The Support Team'."
            ),
        }],
        max_tokens=512,
    )
    data = _parse_json(text, fallback=None)
    if isinstance(data, dict):
        return {"subject": data.get("subject", ""), "body": data.get("body", "")}
    return {"subject": "", "body": text}
