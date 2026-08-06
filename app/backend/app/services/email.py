"""Transactional email via Resend (team #7/#8).

The API key + sender come from the gitignored .env (never committed). Used for
the OTP login code and the account-request notification.
"""

import httpx

from app.core.config import settings

_RESEND_URL = "https://api.resend.com/emails"


class EmailError(Exception):
    pass


def email_status() -> dict:
    """Whether outgoing mail can work here, without revealing any value.

    Surfaced through the super-admin /admin/data-status so "is mail set up on
    this deployment?" is a two-second question rather than a guess. Only
    presence is reported.
    """
    return {
        "configured": bool(settings.resend_api_key and settings.default_from_email),
        "sender_set": bool(settings.default_from_email),
        "sender": settings.default_from_email or None,
        "account_requests_to": settings.account_request_email or None,
    }


async def send_email(to: str, subject: str, html: str) -> None:
    if not settings.resend_api_key:
        raise EmailError("Email is not configured on this deployment.")
    if not settings.default_from_email:
        raise EmailError("The sender address is not configured on this deployment.")
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                _RESEND_URL,
                headers={"Authorization": f"Bearer {settings.resend_api_key}"},
                json={
                    "from": settings.default_from_email,
                    "to": [to],
                    "subject": subject,
                    "html": html,
                },
            )
    except httpx.HTTPError as exc:
        # A container with no outbound access, a DNS failure or a timeout used
        # to escape this function unhandled, so the caller's `except EmailError`
        # never fired and the request died as a bare 500/502 with nothing in it
        # to diagnose. Network trouble is a send failure like any other.
        raise EmailError(f"Cannot reach the mail provider ({type(exc).__name__}).") from exc
    if resp.status_code >= 400:
        raise EmailError(f"The mail provider rejected the message: {resp.status_code} {resp.text[:200]}")


async def send_otp(to: str, code: str) -> None:
    html = (
        "<div style='font-family:sans-serif'>"
        "<h2 style='margin:0 0 8px'>Homora.ai — Təsdiq kodu</h2>"
        f"<p>Giriş üçün təsdiq kodunuz:</p>"
        f"<p style='font-size:30px;font-weight:700;letter-spacing:4px;color:#EE701E'>{code}</p>"
        "<p style='color:#666'>Kod 5 dəqiqə ərzində etibarlıdır. Bu sorğunu siz etməmisinizsə, məktubu nəzərə almayın.</p>"
        "</div>"
    )
    await send_email(to, "Homora.ai — Təsdiq kodu (OTP)", html)


async def send_account_request(data: dict) -> None:
    rows = "".join(
        f"<li><b>{k}:</b> {v}</li>" for k, v in data.items() if k != "password"
    )
    html = (
        "<div style='font-family:sans-serif'>"
        "<h2>Yeni hesab müraciəti — Homora.ai</h2>"
        f"<ul>{rows}</ul></div>"
    )
    await send_email(settings.account_request_email, "Yeni hesab müraciəti — Homora.ai", html)
