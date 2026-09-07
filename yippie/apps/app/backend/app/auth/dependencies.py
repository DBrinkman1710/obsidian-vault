from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
import jwt
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import expand_enabled_modules, get_settings
from app.core.models import Tenant, User, UserRole
from app.core.plans import plan_allows
from app.database import get_db, set_tenant_context


async def get_current_user(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    settings = get_settings()
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    # Cookie-first; fall back to Authorization: Bearer for API clients.
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise credentials_exception
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_uuid = uuid.UUID(payload.get("sub") or "")
    except (jwt.PyJWTError, ValueError):
        # ValueError: a validly-signed token whose sub isn't a UUID is still a
        # bad credential (401), not a server error.
        raise credentials_exception
    # Expose the verified claims of the token that actually authenticated this
    # request (cookie or header), so routes can check e.g. the impersonation
    # flag without re-guessing where the token came from.
    request.state.token_claims = payload

    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account deactivated")
    if user.role != UserRole.superadmin:
        tenant = await db.get(Tenant, user.tenant_id)
        if tenant is None or not tenant.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This workspace is inactive")

    await set_tenant_context(db, user.tenant_id)
    if settings.sentry_dsn:
        import sentry_sdk

        sentry_sdk.set_tag("tenant_id", str(user.tenant_id))
    return user


def _require_role(allowed: tuple[UserRole, ...], detail: str, reset_role: bool = False):
    """Factory — returns a FastAPI dependency that enforces a role.

    When ``reset_role`` is True the connection drops back to the superuser DB role,
    bypassing RLS so the request can read/write across tenants. This is ONLY for
    superadmin (platform-wide tenant management). Regular tenant admins keep the
    ``app_user`` role set by ``set_tenant_context`` so RLS stays enforced.
    """
    async def _check(
        current_user: Annotated[User, Depends(get_current_user)],
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> User:
        if current_user.role not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)
        if reset_role:
            await db.execute(text("RESET ROLE"))
        return current_user
    return _check


require_admin = _require_role(
    (UserRole.admin, UserRole.superadmin),
    "Admin access required",
)

require_superadmin = _require_role(
    (UserRole.superadmin,),
    "Superadmin access required",
    reset_role=True,
)


def require_module(module_name: str):
    """Dependency factory — returns 403 if the current user's tenant doesn't have module enabled."""
    async def _check(
        current_user: Annotated[User, Depends(get_current_user)],
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> None:
        tenant = await db.get(Tenant, current_user.tenant_id)
        # expand_enabled_modules: bundled modules (booking ⊂ calendar) count as
        # enabled even when absent from the stored list.
        if not tenant or module_name not in expand_enabled_modules(tenant.enabled_modules):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": "module_disabled", "module": module_name},
            )
    return _check


def require_feature(feature: str):
    """Dependency factory — gates an advanced feature behind BOTH the module
    being enabled for the tenant AND the tenant's plan unlocking the feature.

    - Module disabled  -> 403 (matches require_module).
    - Plan too low      -> 402 Payment Required, so the frontend can surface an
                           upgrade gate distinct from a plain "module off" state.

    Use alongside require_module so the two compose cleanly:
        dependencies=[Depends(require_module("ai")), Depends(require_feature("ai"))]
    """
    async def _check(
        current_user: Annotated[User, Depends(get_current_user)],
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> None:
        tenant = await db.get(Tenant, current_user.tenant_id)
        if not tenant or feature not in expand_enabled_modules(tenant.enabled_modules):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": "module_disabled", "module": feature},
            )
        if not plan_allows(tenant.plan, feature):
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail={"error": "plan_upgrade_required", "feature": feature, "plan": tenant.plan},
            )
    return _check


async def require_active_subscription(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Walls module APIs when a tenant's trial/subscription has lapsed.

    A lapsed tenant stays active and loginable (so the user can pay) but has
    access_locked_at stamped. Module routes get this dependency so a locked user
    can't bypass the frontend subscribe modal by calling the API directly.

    Returns 402 subscription_required when locked. Superadmins have no single
    tenant context (they manage all tenants) so they're never locked; demo
    tenants are exempt because they never carry a subscription lock.
    """
    if current_user.role == UserRole.superadmin:
        return
    tenant = await db.get(Tenant, current_user.tenant_id)
    if tenant is not None and tenant.access_locked_at is not None and not tenant.is_demo:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="subscription_required",
        )


CurrentUser = Annotated[User, Depends(get_current_user)]
AdminUser = Annotated[User, Depends(require_admin)]
SuperAdminUser = Annotated[User, Depends(require_superadmin)]


def check_module_access(module_key: str):
    """Dependency factory — enforces per-user RBAC access level for a module.

    Returns 403 for 'restricted' access. For 'view' access, allows GET/HEAD/OPTIONS
    but blocks mutating methods (POST/PATCH/PUT/DELETE) with 403.
    Admins and superadmins always pass through (resolved in service).
    """
    async def _check(
        request: Request,
        current_user: Annotated[User, Depends(get_current_user)],
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> None:
        from app.modules.rbac.service import resolve_module_access
        from app.core.models import AccessLevel
        level = await resolve_module_access(db, current_user, module_key)
        if level == AccessLevel.restricted:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": "module_access_restricted", "module": module_key},
            )
        if level == AccessLevel.view and request.method not in ("GET", "HEAD", "OPTIONS"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": "module_access_view_only", "module": module_key},
            )
    return _check
