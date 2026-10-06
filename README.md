# SG Air Quality Monitor

A self-hosted dashboard for Singapore's air quality. It pulls PSI and PM2.5 readings for the five regions from NEA, stores them in SQLite, and serves a small web page with the current values and history. A toggle switches between NEA's PSI and an AQI (US EPA scale) that the app calculates itself from the hourly PM2.5 using the EPA NowCast (not an official reading).

## Quick start

```
docker compose up -d
```

Then open http://localhost:8080.

The first start backfills about 90 days of history, which takes a few minutes. Data is kept in the `aq-data` Docker volume, so restarts skip days already stored.

## API key (optional)

The app works without a key. If you hit data.gov.sg rate limits, set `DATA_GOV_SG_API_KEY` in your shell or in a `.env` file next to `compose.yaml`. Compose passes it through.

## Local development

You need Bun and Node 22.18 or later.

```
bun install
bun run dev:server   # API on :8080
bun run dev:web      # Vite dev server, proxies /api to :8080
bun run test
```

## Data

Data: NEA via [data.gov.sg](https://data.gov.sg).

## Not in v1

- Region detail view: tap a region to see its full per-pollutant breakdown. The data is already stored, so this is UI-only work.
- A small region map in place of the bar list.
- Forecasts, push or email alerts, and user accounts.
- WAQI or other data sources.
