CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS h3_analytics_records (
    id SERIAL PRIMARY KEY,
    h3_index VARCHAR(32) NOT NULL,
    resolution INTEGER NOT NULL,
    period DATE NOT NULL,
    category VARCHAR(128) NOT NULL,
    analysis_type VARCHAR(32) NOT NULL,
    ad_count INTEGER NOT NULL,
    avg_price_kvm DOUBLE PRECISION,
    median_price_kvm DOUBLE PRECISION NOT NULL,
    rayon_name VARCHAR(256) NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_h3_analytics_records_h3_index
    ON h3_analytics_records (h3_index);

CREATE INDEX IF NOT EXISTS ix_h3_analytics_records_resolution
    ON h3_analytics_records (resolution);

CREATE INDEX IF NOT EXISTS ix_h3_analytics_records_period
    ON h3_analytics_records (period);

CREATE INDEX IF NOT EXISTS ix_h3_analytics_records_category
    ON h3_analytics_records (category);

CREATE INDEX IF NOT EXISTS ix_h3_analytics_records_analysis_type
    ON h3_analytics_records (analysis_type);

CREATE INDEX IF NOT EXISTS ix_h3_records_filter_lookup
    ON h3_analytics_records (analysis_type, period, resolution, category);

CREATE INDEX IF NOT EXISTS ix_h3_records_cell_lookup
    ON h3_analytics_records (h3_index, resolution);

CREATE INDEX IF NOT EXISTS ix_h3_records_period_analysis
    ON h3_analytics_records (period, analysis_type);
