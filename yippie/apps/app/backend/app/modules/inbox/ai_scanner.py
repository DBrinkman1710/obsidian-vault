from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Optional

import anthropic

from app.config import get_settings

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


def _client() -> anthropic.AsyncAnthropic:
    return anthropic.AsyncAnthropic(api_key=get_settings().anthropic_api_key)


def _model() -> str:
    return get_settings().ai_model


def _strip_fences(text: str) -> str:
    if text.startswith("```"):
        lines = text.split("\n")
        inner = "\n".join(lines[1:])
        return inner[:inner.rfind("```")].strip() if "```" in inner else inner.strip()
    return text


# Cap the body sent to the model to bound cost/latency on very large emails.
MAX_SCAN_BODY_CHARS = 8000


def _message_text(message) -> str:
    """Safely extract text from an Anthropic response that may have empty/non-text content."""
    for block in getattr(message, "content", None) or []:
        text = getattr(block, "text", None)
        if text:
            return text.strip()
    return ""


def _parse_json(text: str, fallback):
    """Parse model JSON output, returning ``fallback`` on any error."""
    try:
        return json.loads(_strip_fences(text))
    except (json.JSONDecodeError, ValueError, TypeError):
        return fallback


async def scan_message(sender: str, raw_body: str, source: str) -> AIScanResult:
    """Classify an inbound message and extract structured ticket fields."""
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
- low: general inquiry, feedback"""

    message = await _client().messages.create(
        model=_model(), max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    data = _parse_json(_message_text(message), fallback={})
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
    contact: Optional[dict],
    recent_tickets: list[dict],
    billing: Optional[dict],
) -> str:
    contact_block = "Unknown sender — no matching contact found." if not contact else f"""
Name: {contact.get('full_name')}
Company: {contact.get('company') or 'N/A'}
Email: {contact.get('email')}
Phone: {contact.get('phone') or 'N/A'}
Tags: {', '.join(contact.get('tags') or []) or 'none'}
Notes: {contact.get('notes') or 'none'}""".strip()

    billing_block = "No billing data." if not billing else f"""
Subscription: {billing.get('plan_name', 'N/A')} — {billing.get('status', 'N/A')} ({billing.get('billing_cycle', '')})
Amount: {billing.get('amount_cents', 0) / 100:.2f} {billing.get('currency', 'EUR')}
Outstanding invoices: {billing.get('outstanding_invoices', 0)}""".strip()

    tickets_block = "No previous tickets." if not recent_tickets else "\n".join(
        f"- [{t['status'].upper()}] {t['subject']} ({t['priority']} priority)"
        for t in recent_tickets[:5]
    )

    prompt = f"""You are a customer service briefing assistant. Produce a quick-scan briefing for an agent about to review an inbound message.

INBOUND MESSAGE FROM: {sender}
---
{raw_body[:500]}
---

CUSTOMER PROFILE:
{contact_block}

BILLING STATUS:
{billing_block}

RECENT TICKET HISTORY (newest first):
{tickets_block}

Return 4-6 short keywords or phrases, comma-separated, capturing who this customer is and what matters most right now (e.g. "VIP customer, overdue invoice, 3rd complaint this month, prefers Dutch"). No full sentences, no bullet points, no labels — just the comma-separated list."""

    message = await _client().messages.create(
        model=_model(), max_tokens=80,
        messages=[{"role": "user", "content": prompt}],
    )
    return _message_text(message)


async def generate_reply_draft(
    subject: str,
    description: str,
    context_summary: Optional[str],
    contact_name: Optional[str],
    language: str = "en",
) -> str:
    lang_name = LANGUAGE_NAMES.get(language, "English")
    context_block = f"\n\nCustomer context: {context_summary}" if context_summary else ""
    greeting = f"Dear {contact_name}" if contact_name else "Dear Customer"

    prompt = f"""Write a professional, empathetic reply to this customer support request. Sign off as "Support Team". Max 200 words. Return plain text only, no JSON, no markdown.

IMPORTANT: The customer wrote in {lang_name}. Your entire reply MUST be written in {lang_name}.

Support request subject: {subject}
Issue: {description}{context_block}

Begin with: {greeting},"""

    message = await _client().messages.create(
        model=_model(), max_tokens=400,
        messages=[{"role": "user", "content": prompt}],
    )
    return _message_text(message)


async def generate_reply_improvements(
    current_text: str,
    context_summary: Optional[str],
    subject: str,
    language: str = "en",
) -> list[dict]:
    lang_name = LANGUAGE_NAMES.get(language, "English")
    context_block = f"\nCustomer context: {context_summary}" if context_summary else ""

    prompt = f"""You are a customer service writing coach. Suggest up to 3 concrete improvements to this support reply. Return ONLY a JSON array, no other text.

IMPORTANT: All revised replies MUST be written in {lang_name}.

Subject: {subject}{context_block}

Current reply:
{current_text}

Return a JSON array of up to 3 objects:
[{{"label": "short description e.g. More empathetic tone", "revised_text": "complete rewrite of the reply in {lang_name}"}}]"""

    message = await _client().messages.create(
        model=_model(), max_tokens=1200,
        messages=[{"role": "user", "content": prompt}],
    )
    parsed = _parse_json(_message_text(message), fallback=[])
    return parsed[:3] if isinstance(parsed, list) else []


async def generate_compose_suggestion(prompt: str) -> dict:
    """Generate email subject + body from a plain-text brief."""
    message = await _client().messages.create(
        model=_model(), max_tokens=512,
        messages=[{
            "role": "user",
            "content": (
                f"Write a professional customer service email based on this brief:\n\n{prompt}\n\n"
                "Return JSON only: {\"subject\": \"...\", \"body\": \"...\"}\n"
                "Keep the body concise and friendly. Sign off as 'The Support Team'."
            ),
        }],
    )
    text = _message_text(message)
    data = _parse_json(text, fallback=None)
    if isinstance(data, dict):
        return {"subject": data.get("subject", ""), "body": data.get("body", "")}
    return {"subject": "", "body": text}
