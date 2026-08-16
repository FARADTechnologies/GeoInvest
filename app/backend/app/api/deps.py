from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_factory
from app.models.user import User
from app.services import session as session_svc


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session


async def get_current_user(
    db: Annotated[AsyncSession, Depends(get_session)],
    authorization: Annotated[str | None, Header()] = None,
) -> User:
    """Resolve the `Authorization: Bearer <token>` header to a live user.

    Tokens are issued at login and stored by services/session.py, so an
    unknown or expired token is rejected here rather than trusted blindly.
    """
    token = ""
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    email = await session_svc.resolve(token)
    if not email:
        raise HTTPException(status_code=401, detail="Sessiya bitib, yenidən daxil olun")
    user = (
        await db.execute(select(User).where(User.email == email))
    ).scalar_one_or_none()
    if user is None or user.status != "active":
        raise HTTPException(status_code=403, detail="Hesab aktiv deyil")
    return user


async def require_super_admin(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    if user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Bu əməliyyat üçün icazəniz yoxdur")
    return user
