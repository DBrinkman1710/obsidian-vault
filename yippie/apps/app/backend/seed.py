"""
Bootstrap script: creates the tenant record and first superadmin user.
Run once after `alembic upgrade head`. Safe to run on every deploy — fully idempotent.
"""
import asyncio
import os

import bcrypt as _bcrypt
from sqlalchemy import select

from app.config import ALL_MODULES
from app.core.models import Tenant, User, UserRole
from app.database import db_session, get_engine
from app.modules.rbac.service import provision_default_rbac_roles
from app.modules.tickets.models import ResponseTemplate

import json as _json

_STANDARD_TEMPLATES = [
    {
        "name": "Welcome",
        "body": "Welcome aboard! We're thrilled to have you with us. Over the next few days we'll show you how to get the most out of your account. No fluff, just the good stuff. Got a question? Just reply. A real person reads every one.",
        "html": (
            '<table align="center" width="100%" style="max-width:600px;margin:0 auto;'
            "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"
            'background:#f1f5f9;border-spacing:0;">'
            '<tr><td style="background:#ffffff;padding:28px 40px 20px;text-align:center;border-radius:8px 8px 0 0;">'
            '<img src="https://getyippie.com/logo-white-bg.svg" alt="Yippie" style="height:36px;border:0;display:inline-block;" />'
            '</td></tr>'
            '<tr><td style="height:4px;background:#5BA4F5;"></td></tr>'
            '<tr><td style="background:#ffffff;padding:40px 40px 32px;border-radius:0 0 8px 8px;">'
            '<h1 style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 12px;">Welcome aboard, {{first_name}}! 👋</h1>'
            '<p style="font-size:15px;line-height:1.65;color:#374151;margin:0 0 14px;">'
            "We're thrilled to have you with us. Over the next few days we'll show you how to get the most out of your account. No fluff, just the good stuff."
            '</p>'
            '<p style="font-size:15px;line-height:1.65;color:#374151;margin:0 0 28px;">'
            "Got a question? Just reply. A real person reads every one."
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
        "body": "Hi {{first_name}}, thank you for reaching out! We have received your request and a member of our team will get back to you as soon as possible. We will keep you updated.",
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
            '<p style="font-size:14px;color:#0f172a;margin:0;">Ticket #{{ticket_id}}: {{ticket_subject}}</p>'
            '</td></tr></table>'
            '<p style="font-size:15px;line-height:1.65;color:#374151;margin:0 0 28px;">If you have anything to add, simply reply to this email. We\'ll keep you updated every step of the way.</p>'
            '</td></tr>'
            '<tr><td style="padding:20px 0;text-align:center;font-size:12px;color:#94a3b8;">Sent with Yippie</td></tr>'
            '</table>'
        ),
    },
    {
        "name": "Support: Issue resolved",
        "body": "Hi {{first_name}}, great news. Your issue has been resolved. If you have any follow-up questions, just reply to this email.",
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
            '<p style="font-size:15px;line-height:1.65;color:#374151;margin:0 0 28px;">If you have follow-up questions or notice anything else, just reply — we\'re always here to help.</p>'
            '<p style="font-size:13px;line-height:1.5;color:#64748b;margin:0;">Best regards,<br/><strong>{{agent_name}}</strong></p>'
            '</td></tr>'
            '<tr><td style="padding:20px 0;text-align:center;font-size:12px;color:#94a3b8;">Sent with Yippie</td></tr>'
            '</table>'
        ),
    },
    {
        "name": "Support: Follow-up",
        "body": "Hi {{first_name}}, we wanted to check in to make sure everything is working as expected after we helped you recently. Let us know if there's anything else we can do for you.",
        "html": (
            '<table align="center" width="100%" style="max-width:600px;margin:0 auto;'
            "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"
            'background:#f1f5f9;border-spacing:0;">'
            '<tr><td style="background:#ffffff;padding:28px 40px 20px;text-align:center;border-radius:8px 8px 0 0;">'
            '<img src="https://getyippie.com/logo-white-bg.svg" alt="Yippie" style="height:36px;border:0;display:inline-block;" />'
            '</td></tr>'
            '<tr><td style="height:4px;background:#5BA4F5;"></td></tr>'
            '<tr><td style="background:#ffffff;padding:40px 40px 36px;border-radius:0 0 8px 8px;">'
            '<h1 style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 12px;">Checking in, {{first_name}} 👋</h1>'
            '<div style="height:1px;background:#e2e8f0;margin:0 0 20px;"></div>'
            '<p style="font-size:15px;line-height:1.65;color:#374151;margin:0 0 14px;">We wanted to check in to make sure everything is working as expected after we helped you recently.</p>'
            '<p style="font-size:15px;line-height:1.65;color:#374151;margin:0 0 28px;">If there\'s anything else on your mind or if you\'re running into trouble, just hit reply — we\'re here to help.</p>'
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
            '<p style="font-size:15px;line-height:1.65;color:#374151;margin:0 0 14px;">Thank you for your patience. Here\'s the latest on your request:</p>'
            '<table width="100%" style="margin:0 0 24px;border-spacing:0;"><tr>'
            '<td style="background:#f8fafc;border-left:3px solid #5BA4F5;border-radius:0 6px 6px 0;padding:14px 18px;">'
            '<p style="font-size:14px;line-height:1.6;color:#475569;margin:0;">[Describe the update, current status, or next steps]</p>'
            '</td></tr></table>'
            '<p style="font-size:15px;line-height:1.65;color:#374151;margin:0 0 28px;">If you have any follow-up questions, just reply to this email — we\'re happy to help.</p>'
            '<p style="font-size:13px;line-height:1.5;color:#64748b;margin:0;">Best regards,<br/><strong>{{agent_name}}</strong></p>'
            '</td></tr>'
            '<tr><td style="padding:20px 0;text-align:center;font-size:12px;color:#94a3b8;">Sent with Yippie &nbsp;·&nbsp; <a href="#" style="color:#94a3b8;text-decoration:underline;">Unsubscribe</a></td></tr>'
            '</table>'
        ),
    },
]


async def main():
    # Brand-new-tenant bootstrap values come from env vars (tenant settings are
    # otherwise sourced from the DB row at runtime). These only seed the very first
    # tenant; later deploys hit the "already exists" guard and leave the row untouched.
    tenant_id = os.getenv("TENANT_ID", "default")
    tenant_name = os.getenv("TENANT_NAME", "Yippie")
    enabled_modules = os.getenv("ENABLED_MODULES", ",".join(ALL_MODULES)).split(",")
    primary_color = os.getenv("BRANDING_PRIMARY_COLOR", "#5BB8E8")
    logo_url = os.getenv("BRANDING_LOGO_URL") or None
    admin_email = os.getenv("ADMIN_EMAIL", "admin@example.com")
    admin_password = os.getenv("ADMIN_PASSWORD", "changeme123")

    async with db_session() as db:
        # Guard 1: tenant already exists under the expected slug — nothing to do.
        # Branding (primary_color/logo_url) is user-editable in Settings
        # (PATCH /team/branding), so it must NOT be re-synced from env here.
        existing_tenant = await db.scalar(select(Tenant).where(Tenant.slug == tenant_id))
        if existing_tenant:
            print(f"Tenant '{tenant_id}' already exists — ensuring default RBAC roles...")
            await provision_default_rbac_roles(db, existing_tenant.id)
            await db.commit()
            return

        # Guard 2: admin user exists — they may be in a tenant whose slug no longer
        # matches TENANT_ID (e.g. after changing the env var from "default" to "yippie").
        # Sync the slug so the tenant is always findable by TENANT_ID.
        existing_user = await db.scalar(select(User).where(User.email == admin_email))
        if existing_user:
            tenant = await db.get(Tenant, existing_user.tenant_id)
            if tenant and tenant.slug != tenant_id:
                print(
                    f"WARNING: TENANT_ID env var is '{tenant_id}' but existing tenant slug is '{tenant.slug}'. "
                    f"The slug was NOT changed automatically because renaming breaks webhook URLs "
                    f"registered with Mailgun, Evolution API, and other external services. "
                    f"To rename: update the slug via the superadmin API (PATCH /admin/tenant/{tenant.id}) "
                    f"and re-register all external webhooks with the new URL."
                )
            else:
                print(f"User '{admin_email}' already exists — preserving credentials, skipping.")
            return

        # Guard 3: any superadmin exists — never create a second one via automation
        existing_superadmin = await db.scalar(select(User).where(User.role == UserRole.superadmin))
        if existing_superadmin:
            print("A superadmin already exists — skipping superadmin creation.")
            return

        tenant = Tenant(
            slug=tenant_id,
            name=tenant_name,
            enabled_modules=enabled_modules,
            primary_color=primary_color,
            logo_url=logo_url,
        )
        db.add(tenant)
        await db.flush()

        user = User(
            tenant_id=tenant.id,
            email=admin_email,
            full_name="Superadmin",
            hashed_password=_bcrypt.hashpw(admin_password.encode(), _bcrypt.gensalt()).decode(),
            role=UserRole.superadmin,
        )
        db.add(user)
        await db.flush()
        await provision_default_rbac_roles(db, tenant.id)

        # Seed standard response templates so every fresh tenant starts with a
        # useful set of customer-service email templates out of the box.
        for tpl in _STANDARD_TEMPLATES:
            design_json = _json.dumps({"pages": [{"component": tpl["html"]}]})
            db.add(ResponseTemplate(
                tenant_id=tenant.id,
                name=tpl["name"],
                body=tpl["body"],
                html_body=tpl["html"],
                design_json=design_json,
            ))

        await db.commit()
        print(f"Created tenant '{tenant_name}', superadmin '{admin_email}', and {len(_STANDARD_TEMPLATES)} standard templates.")

    await get_engine().dispose()


if __name__ == "__main__":
    asyncio.run(main())
