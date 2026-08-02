"""Server-side batch valuation job.

Mass valuation used to be a loop in the browser: the page called /model/predict
once per flat, so closing the tab killed the run and nothing was kept. The loop
now lives in the backend and its state is a row in this table, so a job keeps
going after the user leaves and can be picked up again when they return.
"""

from datetime import datetime

from sqlalchemy import JSON, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ValuationJob(Base):
    __tablename__ = "valuation_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    # pending | running | done | failed
    status: Mapped[str] = mapped_column(String(16), default="pending", index=True)
    total: Mapped[int] = mapped_column(Integer, default=0)
    done: Mapped[int] = mapped_column(Integer, default=0)
    # Whoever started it, so a user only sees their own runs.
    owner_email: Mapped[str] = mapped_column(String(255), default="", index=True)
    # Portfolio these rows belong to, echoed back so the UI can re-attach them.
    portfolio_id: Mapped[str] = mapped_column(String(64), default="")
    items: Mapped[list] = mapped_column(JSON, default=list)
    results: Mapped[list] = mapped_column(JSON, default=list)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
