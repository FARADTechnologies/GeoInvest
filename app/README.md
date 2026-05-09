# NextGen H3 Analytics

Production-oriented rebuild of the existing H3 geospatial analytics dashboard. This system is isolated in `nextgen_h3_analytics` and does not modify or depend on the Streamlit runtime.

## Architecture

- Frontend: Next.js App Router, React Query, Tailwind CSS, shadcn-style UI components, deck.gl `H3HexagonLayer`, Recharts
- Backend: FastAPI, SQLAlchemy async, PostgreSQL/PostGIS, Redis cache
- Data ingestion: CSV from `../data/h3_analysis_results.csv` into PostgreSQL
- Boundaries: GeoJSON API from `../index_app_object.json`

## Folder Structure

```text
nextgen_h3_analytics/
  backend/
    app/
      api/
      core/
      db/
      models/
      schemas/
      services/
      main.py
    scripts/
      ingest_csv.py
    Dockerfile
    requirements.txt
    .env.example
  frontend/
    src/
      app/
      components/
        dashboard/
        map/
        ui/
      lib/
      types/
    Dockerfile
    package.json
    tailwind.config.ts
    .env.example
  docker/
    postgres/
      001_init.sql
  docker-compose.yml
  README.md
```

## Database Design

Table: `h3_analytics_records`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | serial primary key | surrogate key |
| `h3_index` | varchar(32) | indexed |
| `resolution` | integer | indexed |
| `period` | date | indexed, stored as first day of month |
| `category` | varchar(128) | indexed |
| `analysis_type` | varchar(32) | indexed |
| `ad_count` | integer | aggregated in SQL |
| `avg_price_kvm` | double precision | retained from source CSV |
| `median_price_kvm` | double precision | used for price coloring and metrics |
| `rayon_name` | varchar(256) | tooltip context |

Composite indexes:

- `(analysis_type, period, resolution, category)`
- `(h3_index, resolution)`
- `(period, analysis_type)`

## Run With Docker

From the existing project root:

```powershell
cd nextgen_h3_analytics
docker compose up -d db redis
docker compose run --rm backend python scripts/ingest_csv.py
docker compose up --build backend frontend
```

Open:

- Frontend: `http://localhost:3000`
- Backend docs: `http://localhost:8000/api/v1/docs`
- Health: `http://localhost:8000/health`

## Run Locally

### 1. Backend

Create a PostgreSQL database with PostGIS enabled, then configure the backend:

```powershell
cd nextgen_h3_analytics\backend
Copy-Item .env.example .env
```

Update `.env` if your database or Redis ports differ.

Install dependencies and ingest data:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python scripts\ingest_csv.py
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend

```powershell
cd nextgen_h3_analytics\frontend
Copy-Item .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

## API Examples

### GET `/api/v1/filters`

```powershell
Invoke-RestMethod http://localhost:8000/api/v1/filters
```

Returns:

```json
{
  "periods": ["2026-04", "2026-03"],
  "categories": ["Kohne tikili", "Yeni tikili"],
  "resolutions": [6, 7, 8],
  "analysis_types": ["geom", "pure_h3"]
}
```

### GET `/api/v1/metrics`

```powershell
Invoke-RestMethod "http://localhost:8000/api/v1/metrics?period=2026-04&resolution=7&analysis_type=geom&categories=Yeni%20tikili"
```

Returns:

```json
{
  "total_ads": 1200,
  "avg_median_price": 3100.0,
  "trend_percentage": 4.25,
  "active_h3_cells": 83,
  "previous_period": "2026-03"
}
```

### GET `/api/v1/map-data`

```powershell
Invoke-RestMethod "http://localhost:8000/api/v1/map-data?period=2026-04&resolution=7&analysis_type=geom&categories=Yeni%20tikili"
```

Returns grouped H3 cells only. Polygon coordinates are not returned.

```json
[
  {
    "h3_index": "872ce580cffffff",
    "ad_count": 32,
    "median_price_kvm": 2850.0,
    "category": "Yeni tikili",
    "rayon_name": "Nerimanov rayonu"
  }
]
```

### GET `/api/v1/boundaries`

```powershell
Invoke-RestMethod http://localhost:8000/api/v1/boundaries
```

Returns a GeoJSON `FeatureCollection` from the existing boundary JSON.

## Performance Notes

- `/metrics` and `/map-data` aggregate in PostgreSQL.
- `/map-data` uses `GROUP BY h3_index`; no hex polygon payload is returned.
- Redis caches repeated filter, metric, map, and boundary responses.
- Frontend renders H3 cells with GPU-accelerated deck.gl `H3HexagonLayer`.
- React Query handles client-side cache, loading, error, and refetch states.
