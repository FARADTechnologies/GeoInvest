"""One-shot script: populate precomputed tables from existing h3_analytics_records.

Run this after an initial CSV ingest (ingest_csv.py) to fill the new
h3_map_precomputed and h3_metrics_precomputed tables without needing
the source (Ana) DB connection.

Usage:
    docker compose run --rm backend python scripts/rebuild_precomputed.py
"""

import asyncio
import sys

sys.path.insert(0, "/app")

from app.services.nightly_job import rebuild_precomputed

if __name__ == "__main__":
    asyncio.run(rebuild_precomputed())
    print("Done.")
