-- Pre-computed map data table (per-hex, per-category)
CREATE TABLE IF NOT EXISTS h3_map_precomputed (
    id SERIAL PRIMARY KEY,
    h3_index VARCHAR(32) NOT NULL,
    resolution INTEGER NOT NULL,
    period DATE NOT NULL,
    category VARCHAR(128) NOT NULL,
    analysis_type VARCHAR(32) NOT NULL,
    ad_count INTEGER NOT NULL,
    avg_price_kvm DOUBLE PRECISION,
    median_price_kvm DOUBLE PRECISION NOT NULL,
    rayon_name VARCHAR(256) NOT NULL,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_h3_map_precomputed UNIQUE (analysis_type, period, resolution, category, h3_index)
);

CREATE INDEX IF NOT EXISTS ix_h3_map_pre_filter
    ON h3_map_precomputed (analysis_type, period, resolution, category);

CREATE INDEX IF NOT EXISTS ix_h3_map_pre_cell
    ON h3_map_precomputed (h3_index, resolution);

-- Pre-computed KPI metrics table (per filter combination)
-- category_key is sorted, comma-joined categories (e.g. "Köhne Tikili,Yeni Tikili")
CREATE TABLE IF NOT EXISTS h3_metrics_precomputed (
    id SERIAL PRIMARY KEY,
    analysis_type VARCHAR(32) NOT NULL,
    period DATE NOT NULL,
    resolution INTEGER NOT NULL,
    category_key VARCHAR(512) NOT NULL,
    total_ads INTEGER NOT NULL,
    median_price_kvm DOUBLE PRECISION NOT NULL,
    active_h3_cells INTEGER NOT NULL,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_h3_metrics_precomputed UNIQUE (analysis_type, period, resolution, category_key)
);

CREATE INDEX IF NOT EXISTS ix_h3_metrics_pre_lookup
    ON h3_metrics_precomputed (analysis_type, period, resolution, category_key);

CREATE INDEX IF NOT EXISTS ix_h3_metrics_pre_period
    ON h3_metrics_precomputed (period, analysis_type, resolution);
