from datetime import date

from sqlalchemy import Date, Float, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class MarketStats(Base):
    __tablename__ = "market_stats"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    period: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    true_median_price_kvm: Mapped[float] = mapped_column(Float, nullable=False)
    total_ad_count: Mapped[int] = mapped_column(Integer, nullable=False)

    __table_args__ = (
        Index("ix_market_stats_period_category", "period", "category"),
    )
