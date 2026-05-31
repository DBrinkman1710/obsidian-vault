from __future__ import annotations

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
    """Call Claude to extract structured ticket info from an inbound message."""
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

    import json
    text = message.content[0].text.strip()
    data = json.loads(text)

    return AIScanResult(
        subject=data.get("subject", "New message"),
        description=data.get("description", raw_body[:1000]),
        priority=data.get("priority", "medium"),
        category=data.get("category") if data.get("category") != "null" else None,
    )
