"""
One-off backfill: seed standard templates into all existing tenants.
Uses pg8000 (pure Python) — no compiled C extensions required.
Idempotent: skips template names that already exist per tenant.

Run via:  railway run --service Production python3.12 seed_templates_direct.py
"""
import json
import os
import re
import uuid as uuid_mod
from urllib.parse import urlparse

import pg8000.native

_STANDARD_TEMPLATES = [
    {
        "name": "Welcome",
        "body": "Welcome aboard! We're thrilled to have you with us. Over the next few days we'll show you how to get the most out of your account — no fluff, just the good stuff. Got a question? Just reply to this email — a real person reads every one.",
        "html": (
            '<table align="center" width="100%" style="max-width:600px;margin:0 auto;'
            "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"
            'background:#f1f5f9;border-spacing:0;">'
            '<tr><td style="background:#ffffff;padding:28px 40px 20px;text-align:center;border-radius:8px 8px 0 0;">'
            '<img src="https://getyippie.com/logo-white-bg.svg" alt="Yippie" style="height:36px;border:0;display:inline-block;" />'
            '</td></tr>'
            '<tr><td style="height:4px;background:#5BA4F5;"></td></tr>'
            '<tr><td style="background:#ffffff;padding:40px 40px 32px;border-radius:0 0 8px 8px;">'
            '<h1 style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 12px;">Welcome aboard, {{first_name}}! \U0001f44b</h1>'
            '<p style="font-size:15px;line-height:1.65;color:#374151;margin:0 0 14px;">'
            "We're thrilled to have you with us. Over the next few days we'll show you how to get the most out of your account — no fluff, just the good stuff."
            '</p>'
            '<p style="font-size:15px;line-height:1.65;color:#374151;margin:0 0 28px;">'
            "Got a question? Just reply to this email — a real person reads every one."
            '</p>'
            '<p style="margin:0 0 8px;text-align:center;">'
            '<a href="#" style="display:inline-block;padding:13px 32px;background:#5BA4F5;color:#ffffff;border-radius:8px;font-weight:600;text-decoration:none;font-size:15px;">Get started</a>'
            '</p></td></tr>'
            '<tr><td style="padding:20px 0;text-align:center;font-size:12px;color:#94a3b8;">Sent with Yippie</td></tr>'
            '</table>'
        ),
    },
    {
        "name": "Support: Ticket received",
        "body": "Hi {{first_name}}, thank you for reaching out! We have received your request and a member of our team will get back to you as soon as possible.",
        "html": (
            '<table align="center" width="100%" style="max-width:600px;margin:0 auto;'
            "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"
            'background:#f1f5f9;border-spacing:0;">'
            '<tr><td style="background:#ffffff;padding:28px 40px 20px;text-align:center;border-radius:8px 8px 0 0;">'
            '<img src="https://getyippie.com/logo-white-bg.svg" alt="Yippie" style="height:36px;border:0;display:inline-block;" />'
            '</td></tr>'
            '<tr><td style="height:4px;background:#5BA4F5;"></td></tr>'
            '<tr><td style="background:#ffffff;padding:40px 40px 36px;border-radius:0 0 8px 8px;">'
            '<p style="margin:0 0 20px;"><span style="display:inline-block;padding:4px 12px;background:#f0fdf4;color:#15803d;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">Received</span></p>'
            '<h1 style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 12px;">We\'ve got your request, {{first_name}}</h1>'
            '<div style="height:1px;background:#e2e8f0;margin:0 0 20px;"></div>'
            '<p style="font-size:15px;line-height:1.65;color:#374151;margin:0 0 14px;">Thank you for reaching out. We\'ve received your request and a member of our team will get back to you shortly.</p>'
            '<table width="100%" style="margin:0 0 24px;border-spacing:0;"><tr>'
            '<td style="background:#f8fafc;border-left:3px solid #5BA4F5;border-radius:0 6px 6px 0;padding:14px 18px;">'
            '<p style="font-size:13px;color:#64748b;margin:0 0 4px;font-weight:600;">Reference</p>'
            '<p style="font-size:14px;color:#0f172a;margin:0;">Ticket #{{ticket_id}} — {{ticket_subject}}</p>'
            '</td></tr></table>'
            '<p style="font-size:15px;line-height:1.65;color:#374151;margin:0 0 28px;">If you have anything to add, simply reply to this email.</p>'
            '</td></tr>'
            '<tr><td style="padding:20px 0;text-align:center;font-size:12px;color:#94a3b8;">Sent with Yippie</td></tr>'
            '</table>'
        ),
    },
    {
        "name": "Support: Issue resolved",
        "body": "Hi {{first_name}}, great news — your issue has been resolved. If you have any follow-up questions, just reply to this email.",
        "html": (
            '<table align="center" width="100%" style="max-width:600px;margin:0 auto;'
            "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"
            'background:#f1f5f9;border-spacing:0;">'
            '<tr><td style="background:#ffffff;padding:28px 40px 20px;text-align:center;border-radius:8px 8px 0 0;">'
            '<img src="https://getyippie.com/logo-white-bg.svg" alt="Yippie" style="height:36px;border:0;display:inline-block;" />'
            '</td></tr>'
            '<tr><td style="height:4px;background:#22c55e;"></td></tr>'
            '<tr><td style="background:#ffffff;padding:40px 40px 36px;border-radius:0 0 8px 8px;">'
            '<p style="margin:0 0 20px;"><span style="display:inline-block;padding:4px 12px;background:#f0fdf4;color:#15803d;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">Resolved</span></p>'
            '<h1 style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 12px;">Your issue is resolved, {{first_name}}!</h1>'
            '<div style="height:1px;background:#e2e8f0;margin:0 0 20px;"></div>'
            '<p style="font-size:15px;line-height:1.65;color:#374151;margin:0 0 14px;">Great news — we\'ve taken care of your request. Here\'s a summary of what was done:</p>'
            '<table width="100%" style="margin:0 0 24px;border-spacing:0;"><tr>'
            '<td style="background:#f8fafc;border-left:3px solid #22c55e;border-radius:0 6px 6px 0;padding:14px 18px;">'
            '<p style="font-size:14px;line-height:1.6;color:#475569;margin:0;">[Describe what was resolved and any actions taken]</p>'
            '</td></tr></table>'
            '<p style="font-size:15px;line-height:1.65;color:#374151;margin:0 0 28px;">If you have follow-up questions, just reply — we\'re here to help.</p>'
            '<p style="font-size:13px;line-height:1.5;color:#64748b;margin:0;">Best regards,<br/><strong>{{agent_name}}</strong></p>'
            '</td></tr>'
            '<tr><td style="padding:20px 0;text-align:center;font-size:12px;color:#94a3b8;">Sent with Yippie</td></tr>'
            '</table>'
        ),
    },
    {
        "name": "Support: Follow-up",
        "body": "Hi {{first_name}}, we wanted to check in to make sure everything is working as expected. Let us know if there is anything else we can do for you.",
        "html": (
            '<table align="center" width="100%" style="max-width:600px;margin:0 auto;'
            "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"
            'background:#f1f5f9;border-spacing:0;">'
            '<tr><td style="background:#ffffff;padding:28px 40px 20px;text-align:center;border-radius:8px 8px 0 0;">'
            '<img src="https://getyippie.com/logo-white-bg.svg" alt="Yippie" style="height:36px;border:0;display:inline-block;" />'
            '</td></tr>'
            '<tr><td style="height:4px;background:#5BA4F5;"></td></tr>'
            '<tr><td style="background:#ffffff;padding:40px 40px 36px;border-radius:0 0 8px 8px;">'
            '<h1 style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 12px;">Checking in, {{first_name}} \U0001f44b</h1>'
            '<div style="height:1px;background:#e2e8f0;margin:0 0 20px;"></div>'
            '<p style="font-size:15px;line-height:1.65;color:#374151;margin:0 0 14px;">We wanted to check in to make sure everything is working as expected after we helped you recently.</p>'
            '<p style="font-size:15px;line-height:1.65;color:#374151;margin:0 0 28px;">If there\'s anything else on your mind, just hit reply — we\'re here to help.</p>'
            '<p style="font-size:13px;line-height:1.5;color:#64748b;margin:0;">Best regards,<br/><strong>{{agent_name}}</strong></p>'
            '</td></tr>'
            '<tr><td style="padding:20px 0;text-align:center;font-size:12px;color:#94a3b8;">Sent with Yippie</td></tr>'
            '</table>'
        ),
    },
    {
        "name": "Support: Update",
        "body": "Hi {{first_name}}, we have an update on your request. Please see the details below. If you have any questions, just reply to this email.",
        "html": (
            '<table align="center" width="100%" style="max-width:600px;margin:0 auto;'
            "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"
            'background:#f1f5f9;border-spacing:0;">'
            '<tr><td style="background:#ffffff;padding:28px 40px 20px;text-align:center;border-radius:8px 8px 0 0;">'
            '<img src="https://getyippie.com/logo-white-bg.svg" alt="Yippie" style="height:36px;border:0;display:inline-block;" />'
            '</td></tr>'
            '<tr><td style="height:4px;background:#5BA4F5;"></td></tr>'
            '<tr><td style="background:#ffffff;padding:40px 40px 36px;border-radius:0 0 8px 8px;">'
            '<p style="margin:0 0 20px;"><span style="display:inline-block;padding:4px 12px;background:#eff6ff;color:#2563eb;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">Update</span></p>'
            '<h1 style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 12px;">We have an update on your request, {{first_name}}</h1>'
            '<div style="height:1px;background:#e2e8f0;margin:0 0 20px;"></div>'
            '<p style="font-size:15px;line-height:1.65;color:#374151;margin:0 0 14px;">Thank you for your patience. Here\'s the latest:</p>'
            '<table width="100%" style="margin:0 0 24px;border-spacing:0;"><tr>'
            '<td style="background:#f8fafc;border-left:3px solid #5BA4F5;border-radius:0 6px 6px 0;padding:14px 18px;">'
            '<p style="font-size:14px;line-height:1.6;color:#475569;margin:0;">[Describe the update, current status, or next steps]</p>'
            '</td></tr></table>'
            '<p style="font-size:15px;line-height:1.65;color:#374151;margin:0 0 28px;">If you have follow-up questions, just reply.</p>'
            '<p style="font-size:13px;line-height:1.5;color:#64748b;margin:0;">Best regards,<br/><strong>{{agent_name}}</strong></p>'
            '</td></tr>'
            '<tr><td style="padding:20px 0;text-align:center;font-size:12px;color:#94a3b8;">Sent with Yippie</td></tr>'
            '</table>'
        ),
    },
]


def _parse_dsn(url: str) -> dict:
    """Parse a postgres(ql)(+asyncpg)? URL into pg8000.native.Connection kwargs."""
    url = re.sub(r"^postgresql\+asyncpg://", "postgresql://", url)
    url = re.sub(r"^postgres://", "postgresql://", url)
    p = urlparse(url)
    return {
        "host": p.hostname,
        "port": p.port or 5432,
        "database": p.path.lstrip("/"),
        "user": p.username,
        "password": p.password,
        "ssl_context": True,  # Railway requires SSL
    }


def main() -> None:
    raw_url = os.environ.get("DATABASE_URL", "")
    if not raw_url:
        raise SystemExit(
            "DATABASE_URL not set — run via:\n"
            "  railway run --service Production python3.12 seed_templates_direct.py"
        )

    conn = pg8000.native.Connection(**_parse_dsn(raw_url))
    try:
        tenants = conn.run("SELECT id, name, slug FROM tenants")
        total_added = 0

        for (tenant_id, tenant_name, tenant_slug) in tenants:
            rows = conn.run(
                "SELECT name FROM response_templates WHERE tenant_id = :tid",
                tid=tenant_id,
            )
            existing_names = {row[0] for row in rows}

            added = 0
            for tpl in _STANDARD_TEMPLATES:
                if tpl["name"] in existing_names:
                    continue
                design_json = json.dumps({"pages": [{"component": tpl["html"]}]})
                conn.run(
                    """
                    INSERT INTO response_templates
                        (id, tenant_id, name, body, html_body, design_json, created_at)
                    VALUES (:id, :tenant_id, :name, :body, :html_body, :design_json, NOW())
                    """,
                    id=uuid_mod.uuid4(),
                    tenant_id=tenant_id,
                    name=tpl["name"],
                    body=tpl["body"],
                    html_body=tpl["html"],
                    design_json=design_json,
                )
                added += 1

            status = f"added {added}" if added else "already up to date"
            print(f"  Tenant '{tenant_name}' ({tenant_slug}): {status}")
            total_added += added

        print(f"\nDone — {total_added} template(s) added across {len(tenants)} tenant(s).")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
