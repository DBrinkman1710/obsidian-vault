"""One-time script: promotes ADMIN_EMAIL user to superadmin role."""
import asyncio, os
from sqlalchemy import select, update
from app.core.models import User, UserRole
from app.database import db_session, get_engine

EMAIL = os.getenv("ADMIN_EMAIL", "diederik1710@gmail.com")


async def main():
    try:
        async with db_session() as db:
            user = await db.scalar(select(User).where(User.email == EMAIL))
            if not user:
                print(f"[promote] User '{EMAIL}' not found — skipping.")
                return
            if user.role == UserRole.superadmin:
                print(f"[promote] '{EMAIL}' is already superadmin — skipping.")
                return
            await db.execute(
                update(User).where(User.email == EMAIL).values(role=UserRole.superadmin)
            )
            await db.commit()
            print(f"[promote] Promoted '{EMAIL}' to superadmin.")
    except Exception as e:
        print(f"[promote] ERROR (non-fatal): {e}")
        # Never block startup — log and continue
    finally:
        await get_engine().dispose()


if __name__ == "__main__":
    asyncio.run(main())
