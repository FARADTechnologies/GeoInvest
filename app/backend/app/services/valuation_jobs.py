"""Runs batch valuations server-side.

One flat at a time against the predict model (it is slow, ~20-40 s per row, and
the upstream server is not built for parallel bursts), writing progress to the
job row as it goes. The browser only submits and polls, so closing the tab no
longer cancels anything.
"""

import asyncio
import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_factory
from app.models.valuation_job import ValuationJob
from app.services.predict import PredictError, call_predict, resolve_rayon

logger = logging.getLogger(__name__)

# Only one batch runs at a time per process — the predict server is the
# bottleneck and parallel jobs would just queue behind each other anyway.
_run_lock = asyncio.Lock()


async def create_job(
    session: AsyncSession,
    items: list[dict],
    owner_email: str,
    portfolio_id: str = "",
) -> ValuationJob:
    job = ValuationJob(
        id=str(uuid.uuid4()),
        status="pending",
        total=len(items),
        done=0,
        owner_email=owner_email,
        portfolio_id=portfolio_id,
        items=items,
        results=[],
    )
    session.add(job)
    await session.commit()
    await session.refresh(job)
    return job


async def _update(job_id: str, **fields) -> None:
    async with async_session_factory() as session:
        job = await session.get(ValuationJob, job_id)
        if job is None:
            return
        for key, value in fields.items():
            setattr(job, key, value)
        await session.commit()


async def run_job(job_id: str) -> None:
    """Process every row, persisting after each one so progress survives."""
    async with _run_lock:
        async with async_session_factory() as session:
            job = await session.get(ValuationJob, job_id)
            if job is None or job.status not in {"pending", "running"}:
                return
            items = list(job.items or [])
            # Resume where a restart left off instead of re-valuating (and
            # re-charging) rows that already have a result.
            results: list[dict] = list(job.results or [])
        start = len(results)
        await _update(job_id, status="running")

        try:
            for index, payload in enumerate(items[start:], start=start):
                try:
                    result = await call_predict(payload)
                    result["rayon"] = await resolve_rayon(
                        payload.get("latitude"), payload.get("longitude")
                    )
                    results.append({"index": index, "ok": True, "result": result})
                except PredictError as exc:
                    # One bad row must not abandon the rest of the portfolio.
                    logger.warning("Row %d failed: %s", index, exc.message)
                    results.append({"index": index, "ok": False, "error": exc.message})
                except Exception as exc:  # noqa: BLE001 — keep the batch alive
                    logger.exception("Row %d crashed", index)
                    results.append({"index": index, "ok": False, "error": str(exc)[:300]})
                # Persist after every row: a restart mid-batch keeps what's done.
                await _update(job_id, done=index + 1, results=list(results))
        except Exception as exc:  # noqa: BLE001
            logger.exception("Batch job %s failed", job_id)
            await _update(job_id, status="failed", error=str(exc)[:500])
            return
        await _update(job_id, status="done", results=list(results))
        logger.info("Batch job %s finished (%d rows).", job_id, len(results))


async def resume_unfinished() -> None:
    """Re-queue jobs interrupted by a restart (called on startup)."""
    async with async_session_factory() as session:
        rows = (
            await session.execute(
                select(ValuationJob).where(ValuationJob.status.in_(["pending", "running"]))
            )
        ).scalars().all()
        job_ids = [j.id for j in rows]
    for job_id in job_ids:
        logger.info("Resuming interrupted valuation job %s", job_id)
        asyncio.create_task(run_job(job_id))
