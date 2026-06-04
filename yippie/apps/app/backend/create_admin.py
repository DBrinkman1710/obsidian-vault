"""One-time script: creates admin user if it doesn't exist. Safe to run repeatedly."""
import asyncio, os
from passlib.context import CryptContext
from sqlalchemy import select
from app.core.models import Tenant, User, UserRole
from app.database import db_session, get_engine

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
EMAIL = os.getenv("ADMIN_EMAIL", "diederik1710@gmail.com")
PASSWORD = os.getenv("ADMIN_PASSWORD", "password")


async def main():
    async with db_session() as db:
        # Guard: any superadmin already exists — never reset or duplicate
        existing_super = await db.scalar(select(User).where(User.role == UserRole.superadmin))
        if existing_super:
            print(f"Superadmin already exists ('{existing_super.email}') — skipping.")
            await get_engine().dispose()
            return

        existing = await db.scalar(select(User).where(User.email == EMAIL))
        if existing:
            print(f"User '{EMAIL}' already exists — skipping.")
            await get_engine().dispose()
            return

        tenant = await db.scalar(select(Tenant).limit(1))
        if not tenant:
            tenant = Tenant(slug="default", name="Default Tenant")
            db.add(tenant)
            await db.flush()
            print(f"Created tenant: {tenant.name}")

        db.add(User(
            tenant_id=tenant.id,
            email=EMAIL,
            full_name="Superadmin",
            hashed_password=pwd.hash(PASSWORD),
            role=UserRole.superadmin,
        ))
        await db.commit()
        print(f"Created superadmin user '{EMAIL}'.")

    await get_engine().dispose()


if __name__ == "__main__":
    asyncio.run(main())
