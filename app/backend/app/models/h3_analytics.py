from datetime import date

from sqlalchemy import Date, Float, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class H3AnalyticsRecord(Base):
    __tablename__ = "h3_analytics_records"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    h3_index: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    resolution: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    period: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    analysis_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    ad_count: Mapped[int] = mapped_column(Integer, nullable=False)
    avg_price_kvm: Mapped[float | None] = mapped_column(Float, nullable=True)
    median_price_kvm: Mapped[float] = mapped_column(Float, nullable=False)
    rayon_name: Mapped[str] = mapped_column(String(256), nullable=False)

    __table_args__ = (
        Index(
            "ix_h3_records_filter_lookup",
            "analysis_type",
            "period",
            "resolution",
            "category",
        ),
        Index("ix_h3_records_cell_lookup", "h3_index", "resolution"),
        Index("ix_h3_records_period_analysis", "period", "analysis_type"),
    )
