from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Optional

import anthropic

from app.config import get_settings


@dataclass
class AIScanResult:
    subject: str
    description: str
    priority: str
    category: Optional[str]


async def scan_message(sender: str, raw_body: str, source: str) -> AIScanResult:
    """Classify an inbound message and extract structured ticket fields."""
    settings = get_settings()
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    prompt = f"""You are a customer service assistant. Analyze the following inbound {source} message and extract key information.

From: {sender}
Message:
{raw_body}

Respond with ONLY a JSON object (no markdown, no explanation) with these exact fields:
{{
  "subject": "concise ticket subject, max 80 chars",
  "description": "cleaned-up description of the issue or request",
  "priority": "low | medium | high | urgent",
  "category": "billing | technical | general | complaint | inquiry | null"
}}

Priority guidance:
- urgent: system down, payment failed, legal threat
- high: blocking issue, unhappy customer, time-sensitive
- medium: normal request or question
- low: general inquiry, feedback"""

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )

    text = message.content[0].text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        inner = "\n".join(lines[1:])
        text = inner[:inner.rfind("```")].strip() if "```" in inner else inner.strip()
    data = json.loads(text)
    return AIScanResult(
        subject=data.get("subject", "New message"),
        description=data.get("description", raw_body[:1000]),
        priority=data.get("priority", "medium"),
        category=data.get("category") if data.get("category") != "null" else None,
    )


async def generate_context_summary(
    sender: str,
    raw_body: str,
    contact: Optional[dict],
    recent_tickets: list[dict],
    billing: Optional[dict],
) -> str:
    """
    Generate a 3-4 sentence agent briefing about the customer before they review the draft.
    Combines contact info, billing status, and communication history.
    """
    settings = get_settings()
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    contact_block = "Unknown sender — no matching contact found in the system." if not contact else f"""
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

    prompt = f"""You are a customer service briefing assistant. An agent is about to review an inbound message. Write a concise 3-4 sentence briefing that tells the agent everything relevant about this customer so they can respond confidently.

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

Write a professional briefing paragraph (3-4 sentences). Cover: who this customer is, their current relationship/value, any relevant history, and anything the agent should know before responding. Be direct and factual. Do not use bullet points."""

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}],
    )

    return message.content[0].text.strip()


async def generate_reply_draft(
    subject: str,
    description: str,
    context_summary: Optional[str],
    contact_name: Optional[str],
) -> str:
    settings = get_settings()
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    context_block = f"\n\nCustomer context: {context_summary}" if context_summary else ""
    greeting = f"Dear {contact_name}" if contact_name else "Dear Customer"

    prompt = f"""Write a professional, empathetic reply to this customer support request. Sign off as "Support Team". Max 200 words. Return plain text only, no JSON, no markdown.

Support request subject: {subject}
Issue: {description}{context_block}

Begin with: {greeting},"""

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=400,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text.strip()


async def generate_reply_improvements(
    current_text: str,
    context_summary: Optional[str],
    subject: str,
) -> list[dict]:
    settings = get_settings()
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    context_block = f"\nCustomer context: {context_summary}" if context_summary else ""

    prompt = f"""You are a customer service writing coach. Suggest up to 3 concrete improvements to this support reply. Return ONLY a JSON array, no other text.

Subject: {subject}{context_block}

Current reply:
{current_text}

Return a JSON array of up to 3 objects:
[{{"label": "short description e.g. More empathetic tone", "revised_text": "complete rewrite of the reply"}}]"""

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1200,
        messages=[{"role": "user", "content": prompt}],
    )

    text = message.content[0].text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        inner = "\n".join(lines[1:])
        text = inner[:inner.rfind("```")].strip() if "```" in inner else inner.strip()
    return json.loads(text)[:3]
