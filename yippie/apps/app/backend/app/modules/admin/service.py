from __future__ import annotations

import os
import uuid

from passlib.context import CryptContext
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Tenant, User, UserRole
from app.modules.admin.schemas import AddAdminRequest, TenantCreate, TenantUpdate

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

TENANT_SAFE_FIELDS = {"name", "enabled_modules", "primary_color", "logo_url", "is_active", "is_demo", "go_live_at", "inbound_email"}

# The platform owner's account — same default as promote_superadmin.py / seed.py.
# No one, including other superadmins, may deactivate it.
PROTECTED_SUPERADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "diederik1710@gmail.com").lower()


def _tenant_to_dict(tenant: Tenant, user_count: int) -> dict:
    return {**{c.name: getattr(tenant, c.name) for c in Tenant.__table__.columns}, "user_count": user_count}


async def list_tenants(db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(Tenant, func.count(User.id).label("user_count"))
        .outerjoin(User, User.tenant_id == Tenant.id)
        .group_by(Tenant.id)
        .order_by(Tenant.created_at)
    )
    rows = result.all()
    return [_tenant_to_dict(row.Tenant, row.user_count) for row in rows]


async def create_tenant(db: AsyncSession, data: TenantCreate) -> dict:
    from app.auth.invite import send_invite_email, send_welcome_to_inbox
    from app.core.mailer import ResendNotConfiguredError

    # Never silently overwrite an existing user's credentials
    all_emails = [data.admin_email, *data.extra_admin_emails]
    for email in all_emails:
        existing_user = await db.scalar(select(User).where(User.email == email))
        if existing_user:
            raise ValueError(f"A user with email '{email}' already exists.")

    tenant = Tenant(
        slug=data.slug,
        name=data.name,
        enabled_modules=data.enabled_modules,
        primary_color=data.primary_color,
        logo_url=data.logo_url,
        is_demo=data.is_demo,
        inbound_email=data.inbound_email or None,
    )
    db.add(tenant)
    await db.flush()

    user_count = 0
    invites = list(data.extra_admin_emails)
    if data.admin_password:
        db.add(User(
            tenant_id=tenant.id,
            email=data.admin_email,
            full_name=data.admin_full_name,
            hashed_password=pwd_context.hash(data.admin_password),
            role=UserRole.admin,
        ))
        user_count = 1
    else:
        invites.insert(0, data.admin_email)

    await db.commit()
    await db.refresh(tenant)

    for email in invites:
        full_name = data.admin_full_name if email == data.admin_email else "Admin"
        try:
            await send_invite_email(
                to=email, full_name=full_name, tenant_id=tenant.id,
                role=UserRole.admin.value, tenant_name=tenant.name,
            )
        except ResendNotConfiguredError:
            pass  # tenant is created either way; invites can be re-sent later

    # The product introduction lands in the client's own Yippie inbox — the
    # poller picks it up like any customer mail, so it's the first draft they see.
    if tenant.inbound_email:
        try:
            await send_welcome_to_inbox(tenant.inbound_email, tenant.name)
        except Exception:
            pass  # never block tenant creation on the welcome mail

    return _tenant_to_dict(tenant, user_count)


async def check_email_available(db: AsyncSession, email: str) -> tuple[bool, str | None]:
    """(available, reason) for an address about to be invited/created."""
    from app.core.mailer import is_valid_email

    addr = (email or "").strip().lower()
    if not is_valid_email(addr):
        return False, "Not a valid email address"
    existing = await db.scalar(select(User.id).where(func.lower(User.email) == addr))
    if existing:
        return False, "A user with this email already exists"
    return True, None


async def update_tenant(db: AsyncSession, tenant_id: uuid.UUID, data: TenantUpdate) -> dict | None:
    tenant = await db.get(Tenant, tenant_id)
    if tenant is None:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        if field not in TENANT_SAFE_FIELDS:
            continue  # explicit safelist — never write unexpected fields to the Tenant model
        setattr(tenant, field, value)
    await db.commit()
    await db.refresh(tenant)
    user_count = await db.scalar(select(func.count(User.id)).where(User.tenant_id == tenant.id))
    return _tenant_to_dict(tenant, user_count or 0)


async def get_tenant_users(db: AsyncSession, tenant_id: uuid.UUID) -> list[User]:
    result = await db.execute(select(User).where(User.tenant_id == tenant_id).order_by(User.created_at))
    return result.scalars().all()


async def add_tenant_user(db: AsyncSession, tenant_id: uuid.UUID, data: AddAdminRequest) -> User | dict | None:
    """Add an admin to a tenant. With a password the account is created directly;
    without one an invite email is sent and the account is created on /register."""
    from app.auth.invite import send_invite_email

    tenant = await db.get(Tenant, tenant_id)
    if tenant is None:
        return None
    existing = await db.scalar(select(User).where(User.email == data.email))
    if existing:
        raise ValueError(f"A user with email '{data.email}' already exists.")

    if not data.password:
        await send_invite_email(
            to=data.email, full_name=data.full_name, tenant_id=tenant_id,
            role=UserRole.admin.value, tenant_name=tenant.name,
        )
        return {"invited": True, "email": data.email}

    user = User(
        tenant_id=tenant_id,
        email=data.email,
        full_name=data.full_name,
        hashed_password=pwd_context.hash(data.password),
        role=UserRole.admin,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def patch_tenant_user(db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, is_active: bool) -> User | None:
    user = await db.scalar(select(User).where(User.id == user_id, User.tenant_id == tenant_id))
    if user is None:
        return None
    user.is_active = is_active
    await db.commit()
    await db.refresh(user)
    return user


async def get_impersonation_target(db: AsyncSession, tenant_id: uuid.UUID) -> tuple[Tenant, User] | None:
    """Return (tenant, first active admin user) for impersonation, or None."""
    tenant = await db.get(Tenant, tenant_id)
    if tenant is None:
        return None
    user = await db.scalar(
        select(User)
        .where(User.tenant_id == tenant_id, User.role == UserRole.admin, User.is_active == True)  # noqa: E712
        .order_by(User.created_at)
        .limit(1)
    )
    if user is None:
        return None
    return tenant, user


# Children before parents so plain DELETEs never trip an FK.
TENANT_DELETE_ORDER = [
    "payments", "invoices", "subscriptions",
    "chat_messages", "chat_sessions",
    "ticket_comments", "draft_tickets", "inbound_messages", "pending_sends",
    "activity_events", "tickets", "response_templates",
    "contacts", "departments", "users",
]


def _require_root_owner(current_user: User, current_password: str) -> None:
    if current_user.email.lower() != PROTECTED_SUPERADMIN_EMAIL:
        raise ValueError("Only the root owner can do this")
    if not pwd_context.verify(current_password, current_user.hashed_password):
        raise ValueError("Password incorrect")


async def delete_tenant(
    db: AsyncSession, current_user: User, tenant_id: uuid.UUID, current_password: str
) -> dict:
    """Irreversibly wipe a tenant and all its data. Root owner + password only."""
    from sqlalchemy import text

    _require_root_owner(current_user, current_password)
    tenant = await db.get(Tenant, tenant_id)
    if tenant is None:
        raise LookupError("Tenant not found")
    if tenant.id == current_user.tenant_id:
        raise ValueError("Cannot delete your own tenant")

    name = tenant.name
    for table in TENANT_DELETE_ORDER:
        await db.execute(text(f"DELETE FROM {table} WHERE tenant_id = :tid"), {"tid": str(tenant_id)})
    await db.delete(tenant)
    await db.commit()
    return {"deleted": True, "tenant": name}


async def delete_superadmin(
    db: AsyncSession, current_user: User, user_id: uuid.UUID, current_password: str
) -> dict:
    """Permanently remove a superadmin account. Root owner + password only.
    Use the is_active toggle instead when only suspending."""
    from sqlalchemy import text

    _require_root_owner(current_user, current_password)
    user = await db.get(User, user_id)
    if user is None or user.role != UserRole.superadmin:
        raise LookupError("Superadmin not found")
    if user.id == current_user.id:
        raise ValueError("Cannot delete yourself")
    if user.email.lower() == PROTECTED_SUPERADMIN_EMAIL:
        raise ValueError("Cannot delete the root owner")

    # Null out nullable references so the row can go
    uid = str(user.id)
    for table, col in [
        ("activity_events", "actor_id"), ("contacts", "created_by"),
        ("tickets", "assigned_to"), ("tickets", "created_by"),
        ("ticket_comments", "author_id"),
        ("draft_tickets", "assigned_to"), ("draft_tickets", "reviewed_by"),
    ]:
        await db.execute(text(f"UPDATE {table} SET {col} = NULL WHERE {col} = :uid"), {"uid": uid})

    email = user.email
    await db.delete(user)
    await db.commit()
    return {"deleted": True, "email": email}


async def invite_superadmin(
    db: AsyncSession, current_user: User, email: str, full_name: str, current_password: str
) -> dict:
    """Invite a new superadmin by email — root owner + password only. The invitee
    sets their own password via /register; no password-less accounts are created."""
    from app.auth.invite import send_invite_email

    _require_root_owner(current_user, current_password)
    existing = await db.scalar(select(User).where(User.email == email))
    if existing:
        raise ValueError(f"A user with email '{email}' already exists.")

    # Superadmins live in the root owner's own tenant
    tenant = await db.get(Tenant, current_user.tenant_id)
    await send_invite_email(
        to=email, full_name=full_name, tenant_id=current_user.tenant_id,
        role=UserRole.superadmin.value, tenant_name=tenant.name if tenant else "Yippie",
    )
    return {"invited": True, "email": email}


async def list_superadmins(db: AsyncSession) -> list[User]:
    result = await db.execute(
        select(User).where(User.role == UserRole.superadmin).order_by(User.created_at)
    )
    return result.scalars().all()


async def toggle_superadmin_active(
    db: AsyncSession,
    current_user: User,
    target_id: uuid.UUID,
    is_active: bool,
    current_password: str,
) -> User:
    if not pwd_context.verify(current_password, current_user.hashed_password):
        raise ValueError("Incorrect password.")
    if target_id == current_user.id:
        raise ValueError("You cannot deactivate your own account.")
    target = await db.get(User, target_id)
    if target is None:
        raise LookupError("User not found.")
    if target.role != UserRole.superadmin:
        raise ValueError("User is not a superadmin.")
    if not is_active and target.email.lower() == PROTECTED_SUPERADMIN_EMAIL:
        raise ValueError(f"{target.email} cannot be deactivated.")
    target.is_active = is_active
    await db.commit()
    await db.refresh(target)
    return target


async def bulk_toggle_module(db: AsyncSession, module: str, enabled: bool) -> dict:
    """Add or remove a module from every tenant's enabled_modules list."""
    result = await db.execute(select(Tenant))
    tenants = result.scalars().all()
    for tenant in tenants:
        mods = set(tenant.enabled_modules or [])
        if enabled:
            mods.add(module)
        else:
            mods.discard(module)
        tenant.enabled_modules = list(mods)
    await db.commit()
    return {"module": module, "enabled": enabled, "tenants_updated": len(tenants)}


async def promote_superadmin(
    db: AsyncSession,
    current_user: User,
    target_email: str,
    current_password: str,
) -> User | None:
    if not pwd_context.verify(current_password, current_user.hashed_password):
        raise ValueError("Incorrect password.")
    target = await db.scalar(select(User).where(User.email == target_email))
    if target is None:
        raise LookupError(f"No user found with email '{target_email}'.")
    target.role = UserRole.superadmin
    await db.commit()
    await db.refresh(target)
    return target
