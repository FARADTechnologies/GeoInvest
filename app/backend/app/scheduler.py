import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.services.nightly_job import run_nightly_job

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


def start_scheduler() -> None:
    global _scheduler
    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(
        run_nightly_job,
        CronTrigger(hour=0, minute=0),
        id="nightly_job",
        replace_existing=True,
        misfire_grace_time=3600,  # allow up to 1h delay if app was down at midnight
    )
    _scheduler.start()
    logger.info("Scheduler started — nightly job runs at 00:00.")


def stop_scheduler() -> None:
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped.")
