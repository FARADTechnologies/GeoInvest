from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class H3MapPrecomputed(Base):
    """Per-hex pre-aggregated map data. Refreshed nightly from source DB."""

    __tablename__ = "h3_map_precomputed"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    h3_index: Mapped[str] = mapped_column(String(32), nullable=False)
    resolution: Mapped[int] = mapped_column(Integer, nullable=False)
    period: Mapped[date] = mapped_column(Date, nullable=False)
    category: Mapped[str] = mapped_column(String(128), nullable=False)
    analysis_type: Mapped[str] = mapped_column(String(32), nullable=False)
    ad_count: Mapped[int] = mapped_column(Integer, nullable=False)
    avg_price_kvm: Mapped[float | None] = mapped_column(Float, nullable=True)
    median_price_kvm: Mapped[float] = mapped_column(Float, nullable=False)
    rayon_name: Mapped[str] = mapped_column(String(256), nullable=False)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "analysis_type", "period", "resolution", "category", "h3_index",
            name="uq_h3_map_precomputed",
        ),
        Index("ix_h3_map_pre_filter", "analysis_type", "period", "resolution", "category"),
        Index("ix_h3_map_pre_cell", "h3_index", "resolution"),
    )


class H3MetricsPrecomputed(Base):
    """Pre-computed KPI metrics per filter combination. Refreshed nightly.

    category_key is a sorted, comma-joined string of selected categories,
    e.g. "Yeni Tikili" or "Köhne Tikili,Yeni Tikili" for combined.
    """

    __tablename__ = "h3_metrics_precomputed"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    analysis_type: Mapped[str] = mapped_column(String(32), nullable=False)
    period: Mapped[date] = mapped_column(Date, nullable=False)
    resolution: Mapped[int] = mapped_column(Integer, nullable=False)
    category_key: Mapped[str] = mapped_column(String(512), nullable=False)
    total_ads: Mapped[int] = mapped_column(Integer, nullable=False)
    median_price_kvm: Mapped[float] = mapped_column(Float, nullable=False)
    active_h3_cells: Mapped[int] = mapped_column(Integer, nullable=False)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "analysis_type", "period", "resolution", "category_key",
            name="uq_h3_metrics_precomputed",
        ),
        Index("ix_h3_metrics_pre_lookup", "analysis_type", "period", "resolution", "category_key"),
        Index("ix_h3_metrics_pre_period", "period", "analysis_type", "resolution"),
    )
