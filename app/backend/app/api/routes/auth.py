"""Real OTP login + account registration (team #8 / #7).

Flow:
  POST /auth/register   → create a PENDING account + email the team. The person
                          cannot log in until a super admin approves it.
  POST /auth/login      → verify email+password; refuse unless status is active
                          → generate OTP, email it → { otp_required: true }.
  POST /auth/verify-otp → verify the 6-digit code (5-min TTL) → session token.
  GET  /auth/pending    → super admin: list accounts awaiting approval.
  POST /auth/approve    → super admin: approve or reject one.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi import Header

from app.api.deps import get_current_user, get_session, require_super_admin
from app.core.config import settings
from app.models.user import User
from app.schemas.auth import (
    ApproveRequest,
    ChangePasswordRequest,
    LoginRequest,
    ProfileRequest,
    RegisterRequest,
    RoleRequest,
    StatusRequest,
    VerifyOtpRequest,
)

_ROLES = {"super_admin", "company_admin", "employee"}
_STATUSES = {"active", "blocked", "rejected", "pending"}
from app.services import email as email_svc
from app.services import otp
from app.services import session as session_svc
from app.services.security import hash_password, verify_password

router = APIRouter()


async def _issue_token(user: User) -> dict:
    return {
        "token": await session_svc.create(user.email),
        "user": {"email": user.email, "name": user.name, "role": user.role},
    }


@router.post("/auth/login")
async def login(
    payload: LoginRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict:
    email = payload.email.strip().lower()
    user = (
        await session.execute(select(User).where(User.email == email))
    ).scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="E-poçt və ya şifrə səhvdir")
    # Self-registered accounts stay unusable until a super admin approves them.
    if user.status == "pending":
        raise HTTPException(
            status_code=403,
            detail="Hesabınız hələ təsdiqlənməyib. Super admin təsdiqindən sonra daxil ola biləcəksiniz.",
        )
    if user.status != "active":
        raise HTTPException(status_code=403, detail="Hesab aktiv deyil")
    # Dev-only access: the seed admin signs in without the OTP step so the team
    # can reach the app while email/OTP delivery is still being provisioned.
    # Only this account, only when DEV_LOGIN_BYPASS is on (off in production).
    if settings.dev_login_bypass and email == settings.seed_admin_email.strip().lower():
        return {"otp_required": False, **await _issue_token(user)}
    code = await otp.generate(email)
    try:
        await email_svc.send_otp(email, code)
    except email_svc.EmailError as exc:
        raise HTTPException(status_code=502, detail="OTP kodu göndərilə bilmədi") from exc
    # Logged in only after OTP verification.
    return {"otp_required": True, "email": email}


@router.post("/auth/verify-otp")
async def verify_otp(
    payload: VerifyOtpRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict:
    email = payload.email.strip().lower()
    if not await otp.verify(email, payload.code.strip()):
        raise HTTPException(status_code=401, detail="OTP kodu yanlışdır və ya vaxtı bitib")
    user = (
        await session.execute(select(User).where(User.email == email))
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="İstifadəçi tapılmadı")
    if user.status != "active":
        raise HTTPException(status_code=403, detail="Hesab aktiv deyil")
    return await _issue_token(user)


@router.post("/auth/register")
async def register(
    payload: RegisterRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict:
    """Create a PENDING account and email the request to the team (team #7).

    The account is persisted immediately — so the person keeps the password
    they chose and can sign in from any device once approved — but it stays
    unusable until a super admin flips it to active.
    """
    email = payload.email.strip().lower()
    existing = (
        await session.execute(select(User).where(User.email == email))
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=409, detail="Bu e-poçt artıq qeydiyyatdan keçib")
    if len(payload.password.strip()) < 5:
        raise HTTPException(status_code=422, detail="Şifrə ən azı 5 simvol olmalıdır")

    session.add(
        User(
            email=email,
            password_hash=hash_password(payload.password),
            name=f"{payload.firstName} {payload.lastName}".strip(),
            role="company_admin",
            status="pending",
        )
    )
    await session.commit()

    # Notifying the team is best-effort: the account already exists, so an
    # email outage must not make the user think registration failed.
    try:
        await email_svc.send_account_request(payload.model_dump(exclude={"password"}))
    except email_svc.EmailError:
        pass
    return {"ok": True, "status": "pending"}


@router.get("/auth/pending")
async def list_pending(
    session: Annotated[AsyncSession, Depends(get_session)],
    _: Annotated[User, Depends(require_super_admin)],
) -> dict:
    """Accounts awaiting approval (super admin only)."""
    rows = (
        await session.execute(
            select(User).where(User.status == "pending").order_by(User.created_at)
        )
    ).scalars().all()
    return {
        "items": [
            {"email": u.email, "name": u.name, "created_at": u.created_at.isoformat()}
            for u in rows
        ]
    }


@router.post("/auth/approve")
async def approve(
    payload: ApproveRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    _: Annotated[User, Depends(require_super_admin)],
) -> dict:
    """Approve ("active") or turn down ("rejected") a pending account."""
    if payload.status not in {"active", "rejected"}:
        raise HTTPException(status_code=422, detail="status: active | rejected")
    email = payload.email.strip().lower()
    user = (
        await session.execute(select(User).where(User.email == email))
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="İstifadəçi tapılmadı")
    user.status = payload.status
    await session.commit()
    return {"ok": True, "email": email, "status": user.status}


# ── User administration (super admin) ────────────────────────────────────────


def _user_row(u: User) -> dict:
    return {
        "email": u.email,
        "name": u.name,
        "role": u.role,
        "status": u.status,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


@router.get("/auth/users")
async def list_users(
    session: Annotated[AsyncSession, Depends(get_session)],
    _: Annotated[User, Depends(require_super_admin)],
) -> dict:
    """Every account on the platform — the super admin's user directory."""
    rows = (
        await session.execute(select(User).order_by(User.created_at.desc()))
    ).scalars().all()
    return {"items": [_user_row(u) for u in rows]}


@router.post("/auth/user/role")
async def set_role(
    payload: RoleRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    admin: Annotated[User, Depends(require_super_admin)],
) -> dict:
    if payload.role not in _ROLES:
        raise HTTPException(status_code=422, detail=f"role: {' | '.join(sorted(_ROLES))}")
    email = payload.email.strip().lower()
    if email == admin.email:
        # Otherwise an admin could demote themselves and lock everyone out.
        raise HTTPException(status_code=409, detail="Öz rolunuzu dəyişə bilməzsiniz")
    user = (
        await session.execute(select(User).where(User.email == email))
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="İstifadəçi tapılmadı")
    user.role = payload.role
    await session.commit()
    return {"ok": True, **_user_row(user)}


@router.post("/auth/user/status")
async def set_status(
    payload: StatusRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    admin: Annotated[User, Depends(require_super_admin)],
) -> dict:
    if payload.status not in _STATUSES:
        raise HTTPException(status_code=422, detail=f"status: {' | '.join(sorted(_STATUSES))}")
    email = payload.email.strip().lower()
    if email == admin.email:
        raise HTTPException(status_code=409, detail="Öz hesabınızı bloklaya bilməzsiniz")
    user = (
        await session.execute(select(User).where(User.email == email))
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="İstifadəçi tapılmadı")
    user.status = payload.status
    await session.commit()
    return {"ok": True, **_user_row(user)}


# ── Own account ──────────────────────────────────────────────────────────────


@router.get("/auth/me")
async def me(user: Annotated[User, Depends(get_current_user)]) -> dict:
    return _user_row(user)


@router.post("/auth/profile")
async def update_profile(
    payload: ProfileRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[User, Depends(get_current_user)],
) -> dict:
    user.name = payload.name.strip()[:255]
    session.add(user)
    await session.commit()
    return {"ok": True, **_user_row(user)}


@router.post("/auth/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[User, Depends(get_current_user)],
) -> dict:
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=401, detail="Cari şifrə səhvdir")
    if len(payload.new_password.strip()) < 5:
        raise HTTPException(status_code=422, detail="Yeni şifrə ən azı 5 simvol olmalıdır")
    user.password_hash = hash_password(payload.new_password)
    session.add(user)
    await session.commit()
    return {"ok": True}


@router.post("/auth/logout")
async def logout(
    _: Annotated[User, Depends(get_current_user)],
    authorization: Annotated[str | None, Header()] = None,
) -> dict:
    """Invalidate the caller's session token server-side."""
    if authorization and authorization.lower().startswith("bearer "):
        await session_svc.revoke(authorization[7:].strip())
    return {"ok": True}
