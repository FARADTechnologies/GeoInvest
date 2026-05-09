# GeoInvest

Geospatial real estate analytics for Baku, Azerbaijan. Aggregates property listings onto Uber's H3 hexagonal grid to surface price trends, demand density, and market shifts across the city — by district, resolution, and time period.

![Dashboard](https://raw.githubusercontent.com/FARADTechnologies/GeoInvest/main/screenshots/dashboard.png)

## What it does

- Maps median price per m² and listing density across H3 hexagons at resolutions H6–H8
- Dual analysis modes: administrative boundary (geom) and pure H3 grid
- Period-over-period trend tracking with automatic previous-period comparison
- Adjustable outlier filter to remove low-sample hexagons from analysis
- Color-by control: switch between price heatmap and density heatmap instantly

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14, deck.gl H3HexagonLayer, MapLibre GL, React Query |
| Backend | FastAPI, SQLAlchemy async, PostgreSQL 16 + PostGIS |
| Cache | Redis (120s TTL) |
| Data pipeline | Python + psycopg2, H3 spatial aggregation via PostgreSQL |
| Infrastructure | Docker Compose |

## Project structure

```
GeoInvest/
├── app/                    # Main application
│   ├── backend/            # FastAPI + SQLAlchemy
│   ├── frontend/           # Next.js + deck.gl
│   └── docker-compose.yml
├── pipeline/               # Data pipeline
│   ├── generate_analysis.py   # Pulls from source DB, writes data/h3_analysis.csv
│   └── export_raw_data.py     # Raw export utility
├── data/                   # Data files
│   ├── h3_analysis.csv        # Pre-aggregated H3 analytics (committed)
│   ├── baku_districts.json    # District boundary GeoJSON
│   └── baku_rayons.geojson
└── scripts/                # Exploration & utility scripts
```

## Quick start

```bash
# 1. Copy env files
cp .env.example .env
cp app/backend/.env.example app/backend/.env
cp app/frontend/.env.example app/frontend/.env.local

# 2. Start services
cd app
docker compose up -d db redis
docker compose run --rm backend python scripts/ingest_csv.py
docker compose up --build backend frontend

# 3. Open http://localhost:3000
```

## Regenerating data from source

Set environment variables and run the pipeline:

```bash
export SOURCE_DB_HOST=your_host
export SOURCE_DB_USER=your_user
export SOURCE_DB_PASSWORD=your_password

python pipeline/generate_analysis.py
cd app && docker compose run --rm backend python scripts/ingest_csv.py
```

## Environment variables

**Backend** (`app/backend/.env`):

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://h3:h3@localhost:5433/h3_analytics` | Analytics DB |
| `REDIS_URL` | `redis://localhost:6379/0` | Cache |
| `RAW_DATA_CSV_PATH` | `data/h3_analysis.csv` | Input data |
| `BOUNDARIES_JSON_PATH` | `data/baku_districts.json` | District boundaries |
| `CACHE_TTL_SECONDS` | `120` | API cache TTL |

**Pipeline** (environment variables):

| Variable | Description |
|----------|-------------|
| `SOURCE_DB_HOST` | Source database host |
| `SOURCE_DB_USER` | Source database user |
| `SOURCE_DB_PASSWORD` | Source database password |
| `SOURCE_DB_NAME` | Source database name (default: `source_dev_db`) |
