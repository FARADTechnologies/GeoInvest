"""Real OTP login + account request (team #8 / #7).

Flow:
  POST /auth/login  → verify email+password → generate OTP, email it, but do NOT
                      log in yet → { otp_required: true }.
  POST /auth/verify-otp → verify the 6-digit code (5-min TTL) → return a token.
  POST /auth/register → email the account request to the team.
"""

import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session
from app.core.config import settings
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, VerifyOtpRequest
from app.services import email as email_svc
from app.services import otp
from app.services.security import verify_password

router = APIRouter()


def _issue_token(user: User) -> dict:
    return {
        "token": secrets.token_urlsafe(32),
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
    # Dev-only access: the seed admin signs in without the OTP step so the team
    # can reach the app while email/OTP delivery is still being provisioned.
    # Only this account, only when DEV_LOGIN_BYPASS is on (off in production).
    if settings.dev_login_bypass and email == settings.seed_admin_email.strip().lower():
        return {"otp_required": False, **_issue_token(user)}
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
    return _issue_token(user)


@router.post("/auth/register")
async def register(payload: RegisterRequest) -> dict:
    """Email the account-request to the team (team #7, item 7)."""
    try:
        await email_svc.send_account_request(payload.model_dump())
    except email_svc.EmailError as exc:
        raise HTTPException(status_code=502, detail="Müraciət göndərilə bilmədi") from exc
    return {"ok": True}
