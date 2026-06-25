"""
One-off: seed standard templates into the Yippie production tenant via REST API.
Uses only stdlib — no extra packages needed.

Run:  python3 seed_templates_api.py
      (prompts for password; email defaults to diederik@getyippie.com)
"""
import getpass
import json
import sys
import urllib.error
import urllib.request

BASE = "https://app.getyippie.com/api/v1"

_STANDARD_TEMPLATES = [
    {
        "name": "Welcome",
        "body": "Welcome aboard! We're thrilled to have you with us. Over the next few days we'll show you how to get the most out of your account — no fluff, just the good stuff. Got a question? Just reply to this email — a real person reads every one.",
        "html_body": (
            '<table align="center" width="100%" style="max-width:600px;margin:0 auto;'
            "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"
            'background:#f1f5f9;border-spacing:0;">'
            '<tr><td style="background:#ffffff;padding:28px 40px 20px;text-align:center;border-radius:8px 8px 0 0;">'
            '<img src="https://getyippie.com/logo-white-bg.svg" alt="Yippie" style="height:36px;border:0;display:inline-block;" />'
            '</td></tr>'
            '<tr><td style="height:4px;background:#5BA4F5;"></td></tr>'
            '<tr><td style="background:#ffffff;padding:40px 40px 32px;border-radius:0 0 8px 8px;">'
            '<h1 style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 12px;">Welcome aboard, {{first_name}}! \U0001f44b</h1>'
            '<p style="font-size:15px;line-height:1.65;color:#374151;margin:0 0 14px;">We\'re thrilled to have you with us.</p>'
            '<p style="font-size:15px;line-height:1.65;color:#374151;margin:0 0 28px;">Got a question? Just reply to this email — a real person reads every one.</p>'
            '<p style="margin:0 0 8px;text-align:center;">'
            '<a href="#" style="display:inline-block;padding:13px 32px;background:#5BA4F5;color:#ffffff;border-radius:8px;font-weight:600;text-decoration:none;font-size:15px;">Get started</a>'
            '</p></td></tr>'
            '<tr><td style="padding:20px 0;text-align:center;font-size:12px;color:#94a3b8;">Sent with Yippie</td></tr>'
            '</table>'
        ),
    },
    {
        "name": "Support: Ticket received",
        "body": "Hi {{first_name}}, thank you for reaching out! We have received your request and will get back to you shortly.",
        "html_body": (
            '<table align="center" width="100%" style="max-width:600px;margin:0 auto;'
            "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"
            'background:#f1f5f9;border-spacing:0;">'
            '<tr><td style="background:#ffffff;padding:28px 40px 20px;text-align:center;border-radius:8px 8px 0 0;">'
            '<img src="https://getyippie.com/logo-white-bg.svg" alt="Yippie" style="height:36px;border:0;display:inline-block;" />'
            '</td></tr>'
            '<tr><td style="height:4px;background:#5BA4F5;"></td></tr>'
            '<tr><td style="background:#ffffff;padding:40px 40px 36px;border-radius:0 0 8px 8px;">'
            '<p style="margin:0 0 20px;"><span style="display:inline-block;padding:4px 12px;background:#f0fdf4;color:#15803d;border-radius:999px;font-size:12px;font-weight:700;text-transform:uppercase;">Received</span></p>'
            '<h1 style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 12px;">We\'ve got your request, {{first_name}}</h1>'
            '<div style="height:1px;background:#e2e8f0;margin:0 0 20px;"></div>'
            '<p style="font-size:15px;line-height:1.65;color:#374151;margin:0 0 14px;">Thank you for reaching out. A member of our team will get back to you shortly.</p>'
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
        "html_body": (
            '<table align="center" width="100%" style="max-width:600px;margin:0 auto;'
            "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"
            'background:#f1f5f9;border-spacing:0;">'
            '<tr><td style="background:#ffffff;padding:28px 40px 20px;text-align:center;border-radius:8px 8px 0 0;">'
            '<img src="https://getyippie.com/logo-white-bg.svg" alt="Yippie" style="height:36px;border:0;display:inline-block;" />'
            '</td></tr>'
            '<tr><td style="height:4px;background:#22c55e;"></td></tr>'
            '<tr><td style="background:#ffffff;padding:40px 40px 36px;border-radius:0 0 8px 8px;">'
            '<p style="margin:0 0 20px;"><span style="display:inline-block;padding:4px 12px;background:#f0fdf4;color:#15803d;border-radius:999px;font-size:12px;font-weight:700;text-transform:uppercase;">Resolved</span></p>'
            '<h1 style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 12px;">Your issue is resolved, {{first_name}}!</h1>'
            '<div style="height:1px;background:#e2e8f0;margin:0 0 20px;"></div>'
            '<p style="font-size:15px;line-height:1.65;color:#374151;margin:0 0 14px;">Great news — we\'ve taken care of your request.</p>'
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
        "html_body": (
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
        "body": "Hi {{first_name}}, we have an update on your request. Please see the details below.",
        "html_body": (
            '<table align="center" width="100%" style="max-width:600px;margin:0 auto;'
            "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"
            'background:#f1f5f9;border-spacing:0;">'
            '<tr><td style="background:#ffffff;padding:28px 40px 20px;text-align:center;border-radius:8px 8px 0 0;">'
            '<img src="https://getyippie.com/logo-white-bg.svg" alt="Yippie" style="height:36px;border:0;display:inline-block;" />'
            '</td></tr>'
            '<tr><td style="height:4px;background:#5BA4F5;"></td></tr>'
            '<tr><td style="background:#ffffff;padding:40px 40px 36px;border-radius:0 0 8px 8px;">'
            '<p style="margin:0 0 20px;"><span style="display:inline-block;padding:4px 12px;background:#eff6ff;color:#2563eb;border-radius:999px;font-size:12px;font-weight:700;text-transform:uppercase;">Update</span></p>'
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


def _post(url: str, payload: dict, token: str | None = None) -> dict:
    data = json.dumps(payload).encode()
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def _get(url: str, token: str) -> list:
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def main() -> None:
    email = input(f"Email [{' diederik@getyippie.com'}]: ").strip() or "diederik@getyippie.com"
    password = getpass.getpass("Password: ")

    print("Logging in…")
    try:
        resp = _post(f"{BASE}/auth/login", {"email": email, "password": password})
    except urllib.error.HTTPError as e:
        raise SystemExit(f"Login failed ({e.code}): {e.read().decode()}") from e

    token = resp.get("access_token")
    if not token:
        raise SystemExit(f"No token in response: {resp}")
    print("Logged in.")

    print("Fetching existing templates…")
    existing = _get(f"{BASE}/tickets/templates", token)
    existing_names = {t["name"] for t in existing}
    print(f"  {len(existing_names)} template(s) already exist.")

    added = 0
    for tpl in _STANDARD_TEMPLATES:
        if tpl["name"] in existing_names:
            print(f"  SKIP  '{tpl['name']}' (already exists)")
            continue
        design_json = json.dumps({"pages": [{"component": tpl["html_body"]}]})
        payload = {
            "name": tpl["name"],
            "body": tpl["body"],
            "html_body": tpl["html_body"],
            "design_json": design_json,
            "campaign_buttons": None,
        }
        try:
            _post(f"{BASE}/tickets/templates", payload, token)
            print(f"  OK    '{tpl['name']}'")
            added += 1
        except urllib.error.HTTPError as e:
            print(f"  ERR   '{tpl['name']}': {e.code} {e.read().decode()}")

    print(f"\nDone — {added} template(s) added.")


if __name__ == "__main__":
    main()
