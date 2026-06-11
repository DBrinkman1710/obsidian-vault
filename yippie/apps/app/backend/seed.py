"""
Bootstrap script: creates the tenant record and first superadmin user.
Run once after `alembic upgrade head`. Safe to run on every deploy — fully idempotent.
"""
import asyncio
import os

from passlib.context import CryptContext
from sqlalchemy import select

from app.config import load_tenant_config
from app.core.models import Tenant, User, UserRole
from app.database import db_session, get_engine

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def main():
    cfg = load_tenant_config()
    admin_email = os.getenv("ADMIN_EMAIL", "admin@example.com")
    admin_password = os.getenv("ADMIN_PASSWORD", "changeme123")

    async with db_session() as db:
        # Guard 1: tenant already exists — sync branding from config but skip user creation
        existing_tenant = await db.scalar(select(Tenant).where(Tenant.slug == cfg.tenant_id))
        if existing_tenant:
            changed = False
            if existing_tenant.primary_color != cfg.branding.primary_color:
                existing_tenant.primary_color = cfg.branding.primary_color
                changed = True
            if existing_tenant.logo_url != cfg.branding.logo_url:
                existing_tenant.logo_url = cfg.branding.logo_url
                changed = True
            if changed:
                await db.commit()
                print(f"Tenant '{cfg.tenant_id}' branding updated from config.")
            else:
                print(f"Tenant '{cfg.tenant_id}' already exists — skipping.")
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
            slug=cfg.tenant_id,
            name=cfg.tenant_name,
            enabled_modules=cfg.enabled_modules,
            primary_color=cfg.branding.primary_color,
            logo_url=cfg.branding.logo_url,
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
        await db.commit()
        print(f"Created tenant '{cfg.tenant_name}' and superadmin '{admin_email}'.")

    await get_engine().dispose()


if __name__ == "__main__":
    asyncio.run(main())
