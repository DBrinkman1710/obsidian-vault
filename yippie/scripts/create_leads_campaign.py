#!/usr/bin/env python3
"""
Create a "Book a Call / Request a Demo" outreach campaign targeting leads in Yippie.

Usage:
  AUTH_TOKEN=<your-bearer-token> python3 scripts/create_leads_campaign.py

Get your token: open sandbox.getyippie.com, open DevTools → Application →
Local Storage → find 'token' or check the Authorization header in any API call.
"""
import json
import os
import sys
import uuid
import urllib.request

BASE = "https://sandbox.getyippie.com/api/v1"
TOKEN = os.environ.get("AUTH_TOKEN", "")

if not TOKEN:
    print("ERROR: set AUTH_TOKEN environment variable first.")
    sys.exit(1)


def call(method: str, path: str, body=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


# 1. Fetch pipeline stages
print("Fetching pipeline stages…")
stages = call("GET", "/pipeline/stages")
stage_map = {s["name"]: s["id"] for s in stages}
print("  Stages found:", list(stage_map.keys()))

call_planned_id = stage_map.get("Call Planned")
demo_id = stage_map.get("Demo")
campaign_sent_id = stage_map.get("Campaign Sent")
lead_stage_id = stage_map.get("Lead") or stage_map.get("Questionnaire Lead")

if not call_planned_id:
    print("WARNING: 'Call Planned' stage not found — Book a Call button won't move stage.")
if not demo_id:
    print("WARNING: 'Demo' stage not found — Request a Demo button won't move stage.")
if not campaign_sent_id:
    print("WARNING: 'Campaign Sent' stage not found — post-send stage move disabled.")

# 2. Fetch tenant config for slug (needed for the /meet/{slug} booking URL)
print("Fetching tenant config…")
config = call("GET", "/tenant/config")
tenant_slug = config.get("slug", "")
booking_url = f"https://sandbox.getyippie.com/meet/{tenant_slug}" if tenant_slug else ""
print(f"  Tenant slug: {tenant_slug}  →  booking URL: {booking_url}")

# 3. Create the campaign
print("Creating campaign…")
campaign = call("POST", "/marketing/campaigns", {
    "name": "June 2026 — Book a Call / Request Demo",
    "subject": "Quick question for you, {{first_name}}",
    "dispatch_channel": "email",
})
campaign_id = campaign["id"]
print(f"  Campaign created: {campaign_id}")

# 4. Build the button IDs
btn_call_id = str(uuid.uuid4())
btn_demo_id = str(uuid.uuid4())

campaign_buttons = [
    {
        "id": btn_call_id,
        "text": "Book a Call",
        "action_type": "pipeline_stage",
        "stage_id": call_planned_id,
        "label_id": None,
        "action_value": None,
        "redirect_url": booking_url or None,
    },
    {
        "id": btn_demo_id,
        "text": "Request a Demo",
        "action_type": "pipeline_stage",
        "stage_id": demo_id,
        "label_id": None,
        "action_value": None,
        "redirect_url": "https://getyippie.com/request-demo",
    },
]

# 5. Email HTML — professional outreach template
# Button hrefs are '#' here; the dispatch loop replaces them with tracking URLs.
email_html = f"""
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f4f8;padding:32px 16px;font-family:Georgia,serif;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr>
          <td style="background-color:#5BA4F5;padding:22px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td><span style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#ffffff;">Yippie</span></td>
                <td align="right"><span style="font-family:Arial,sans-serif;font-size:11px;font-weight:600;color:rgba(255,255,255,0.75);letter-spacing:1.5px;text-transform:uppercase;">Customer Service Platform</span></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr><td style="height:3px;background:#5BA4F5;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr>
          <td style="padding:44px 48px 36px;">
            <p style="margin:0 0 24px;font-family:Georgia,serif;font-size:17px;line-height:1.7;color:#1e293b;">Hi {{{{first_name}}}},</p>
            <p style="margin:0 0 18px;font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#334155;">
              Thanks for filling out the questionnaire — I appreciated the time you took. We built Yippie for teams exactly like yours: an <strong style="color:#1e293b;">AI-assisted inbox</strong> that drafts replies, triages urgency, and keeps your full customer pipeline in one clean view.
            </p>
            <p style="margin:0 0 18px;font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#334155;">
              Most teams are up and running in under five minutes — no migrations, no bloat, no six-figure contracts.
            </p>
            <p style="margin:0 0 36px;font-family:Georgia,serif;font-size:16px;line-height:1.8;color:#334155;">
              I'd love to show you how Yippie can help — whether that's a quick call or a hands-on walkthrough at your own pace.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
              <tr><td style="height:1px;background:#e2e8f0;font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>
            <p style="margin:0 0 20px;font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:#94a3b8;text-align:center;">Choose how you'd like to connect</p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="right" style="padding-right:8px;">
                  <a data-yippie-button="1"
                     data-action-type="pipeline_stage"
                     data-stage-id="{call_planned_id or ''}"
                     data-redirect-url="{booking_url}"
                     id="{btn_call_id}"
                     href="#"
                     style="display:inline-block;padding:14px 28px;background-color:#5BA4F5;color:#ffffff;text-decoration:none;border-radius:5px;font-family:Arial,sans-serif;font-size:14px;font-weight:700;white-space:nowrap;">
                    Book a Call
                  </a>
                </td>
                <td align="left" style="padding-left:8px;">
                  <a data-yippie-button="1"
                     data-action-type="pipeline_stage"
                     data-stage-id="{demo_id or ''}"
                     data-redirect-url="https://getyippie.com/request-demo"
                     id="{btn_demo_id}"
                     href="#"
                     style="display:inline-block;padding:13px 28px;background-color:#ffffff;color:#5BA4F5;text-decoration:none;border-radius:5px;border:2px solid #5BA4F5;font-family:Arial,sans-serif;font-size:14px;font-weight:700;white-space:nowrap;">
                    Request a Demo
                  </a>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:44px;border-top:1px solid #f1f5f9;padding-top:28px;">
              <tr>
                <td>
                  <p style="margin:0 0 2px;font-family:Georgia,serif;font-size:15px;font-weight:700;color:#1e293b;">Diederik Brinkman</p>
                  <p style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:13px;color:#64748b;">Founder, Yippie</p>
                  <table cellpadding="0" cellspacing="0" border="0"><tr>
                    <td style="padding-right:10px;"><a href="https://getyippie.com" style="font-family:Arial,sans-serif;font-size:12px;color:#5BA4F5;text-decoration:none;">getyippie.com</a></td>
                    <td style="color:#cbd5e1;font-size:12px;">·</td>
                    <td style="padding-left:10px;"><a href="mailto:diederik@getyippie.com" style="font-family:Arial,sans-serif;font-size:12px;color:#5BA4F5;text-decoration:none;">diederik@getyippie.com</a></td>
                  </tr></table>
                </td>
                <td align="right" valign="middle">
                  <div style="width:44px;height:44px;border-radius:50%;background-color:#EFF6FF;border:2px solid #BFDBFE;display:inline-block;text-align:center;line-height:40px;">
                    <span style="font-family:Georgia,serif;font-size:18px;font-weight:700;color:#5BA4F5;">D</span>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f8fafc;padding:20px 48px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;color:#94a3b8;line-height:1.6;text-align:center;">
              You're receiving this because you expressed interest in Yippie.
              <a href="#" style="color:#5BA4F5;text-decoration:underline;">Unsubscribe</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
""".strip()

# 6. Save the template
print("Saving email template…")
call("POST", f"/marketing/campaigns/{campaign_id}/templates", {
    "templates": [{
        "variant": None,
        "raw_html": email_html,
        "raw_css": "",
        "design_json": None,
        "campaign_buttons": campaign_buttons,
    }]
})
print("  Template saved.")

# 7. Set audience + post-send stage
audience_payload = {
    "segment_filter": {
        "filter_by": "pipeline_stage" if lead_stage_id else "all",
        "filter_id": lead_stage_id,
        "min_engagement_score": None,
    },
}
if campaign_sent_id:
    audience_payload["post_send_stage_id"] = campaign_sent_id

print("Setting audience…")
call("PATCH", f"/marketing/campaigns/{campaign_id}", audience_payload)
print(f"  Segment: {'pipeline_stage → ' + (stage_map.get('Lead') and 'Lead' or 'Questionnaire Lead') if lead_stage_id else 'all contacts'}")
if campaign_sent_id:
    print("  Post-send stage: Campaign Sent ✓")

print()
print("=" * 60)
print("Campaign ready!")
print(f"  → https://sandbox.getyippie.com/marketing/{campaign_id}")
print()
print("Next steps:")
print("  1. Open the link above")
print("  2. Design tab → review the email preview")
print("  3. Audience tab → confirm recipient count + 'Campaign Sent' stage is selected")
print("  4. Schedule tab → click 'Test send' to send yourself a preview")
print("  5. Click 'Launch now' when ready")
