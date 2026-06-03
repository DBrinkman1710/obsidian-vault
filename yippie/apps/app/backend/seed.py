"""
Bootstrap script: creates the tenant record and first admin user.
Run once after `alembic upgrade head`:
  docker compose run backend python seed.py
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
        existing = await db.scalar(select(Tenant).where(Tenant.slug == cfg.tenant_id))
        if existing:
            print(f"Tenant '{cfg.tenant_id}' already exists — skipping.")
            return

        tenant = Tenant(slug=cfg.tenant_id, name=cfg.tenant_name)
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
        print(f"Created tenant '{cfg.tenant_name}' and admin user '{admin_email}'.")

    await get_engine().dispose()


if __name__ == "__main__":
    asyncio.run(main())
