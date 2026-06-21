"""
Bootstrap script: creates the tenant record and first superadmin user.
Run once after `alembic upgrade head`. Safe to run on every deploy — fully idempotent.
"""
import asyncio
import os

from passlib.context import CryptContext
from sqlalchemy import select

from app.config import ALL_MODULES
from app.core.models import Tenant, User, UserRole
from app.database import db_session, get_engine
from app.modules.rbac.service import provision_default_rbac_roles

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


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
        # Guard 1: tenant already exists — skip. Branding (primary_color/logo_url) is
        # user-editable in Settings (PATCH /team/branding), so it must NOT be re-synced
        # from env here — doing so clobbered the user's chosen colour on every deploy.
        # The env branding only seeds a brand-new tenant (below).
        existing_tenant = await db.scalar(select(Tenant).where(Tenant.slug == tenant_id))
        if existing_tenant:
            print(f"Tenant '{tenant_id}' already exists — ensuring default RBAC roles...")
            await provision_default_rbac_roles(db, existing_tenant.id)
            await db.commit()
            return

        # Guard 2: user with this email already exists anywhere in the system
        existing_user = await db.scalar(select(User).where(User.email == admin_email))
        if existing_user:
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
            hashed_password=pwd_context.hash(admin_password),
            role=UserRole.superadmin,
        )
        db.add(user)
        await db.flush()
        await provision_default_rbac_roles(db, tenant.id)
        await db.commit()
        print(f"Created tenant '{tenant_name}' and superadmin '{admin_email}'.")

    await get_engine().dispose()


if __name__ == "__main__":
    asyncio.run(main())
