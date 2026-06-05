from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.models import Tenant, User, UserRole
from app.database import get_db, set_tenant_context

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    settings = get_settings()
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, settings.secret_key, algorithms=[settings.algorithm])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception

    await set_tenant_context(db, user.tenant_id)
    return user


def _require_role(allowed: tuple[UserRole, ...], detail: str):
    """Factory — returns a FastAPI dependency that enforces a role and resets the DB role."""
    async def _check(
        current_user: Annotated[User, Depends(get_current_user)],
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> User:
        if current_user.role not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)
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
)


def require_module(module_name: str):
    """Dependency factory — returns 403 if the current user's tenant doesn't have module enabled."""
    async def _check(
        current_user: Annotated[User, Depends(get_current_user)],
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> None:
        tenant = await db.get(Tenant, current_user.tenant_id)
        if not tenant or module_name not in (tenant.enabled_modules or []):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": "module_disabled", "module": module_name},
            )
    return _check


CurrentUser = Annotated[User, Depends(get_current_user)]
AdminUser = Annotated[User, Depends(require_admin)]
SuperAdminUser = Annotated[User, Depends(require_superadmin)]
