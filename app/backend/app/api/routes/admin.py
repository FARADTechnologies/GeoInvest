"""Operational endpoints for a super admin.

The H3 analytics tables are rebuilt by a nightly job at 00:00. That job had no
way to be inspected or triggered from outside the container, so when it stopped
producing fresh periods nobody could tell whether it was failing or simply not
running. These endpoints make it observable and re-runnable.
"""

import asyncio
import logging
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app.api.deps import require_super_admin
from app.models.user import User
from app.services.email import email_status
from app.services.nightly_job import last_run_info, run_nightly_job

logger = logging.getLogger(__name__)
router = APIRouter()

# Guards against a second rebuild starting while one is still running — the job
# truncates and repopulates h3_analytics, so overlapping runs would fight.
_lock = asyncio.Lock()


async def _run_guarded() -> None:
    if _lock.locked():
        logger.info("Refresh already running — skipping duplicate trigger.")
        return
    async with _lock:
        try:
            await run_nightly_job()
        except Exception:
            # Already logged and recorded in last_run_info; swallow so the
            # background task doesn't raise into the event loop.
            logger.exception("Manual refresh failed.")


@router.get("/admin/data-status")
async def data_status(_: Annotated[User, Depends(require_super_admin)]) -> dict:
    """Freshness of the analytics tables, the last refresh, and mail readiness.

    The mail block answers "can this deployment send the OTP at all?" — a
    question that previously could only be settled by triggering a real login
    and reading the failure. It reports presence, never a value.
    """
    return {
        "refresh": last_run_info(),
        "running": _lock.locked(),
        "email": email_status(),
    }


@router.post("/admin/refresh")
async def refresh(
    background: BackgroundTasks,
    _: Annotated[User, Depends(require_super_admin)],
) -> dict:
    """Re-run the nightly rebuild now. Returns immediately; poll data-status."""
    if _lock.locked():
        raise HTTPException(status_code=409, detail="Yeniləmə artıq gedir")
    background.add_task(_run_guarded)
    return {"ok": True, "started": True}
