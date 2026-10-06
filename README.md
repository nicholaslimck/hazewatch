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

## Telegram alerts

Optional. The bot messages people when their region's 24h PSI turns unhealthy, changes band or clears, and never between 11pm and 7am SGT.

1. Message @BotFather, send `/newbot`, and pick a name and username (suggested: `@HazeCheckSG_bot`).
2. Set `TELEGRAM_BOT_TOKEN` to the token it gives you, in your shell or `.env`. Without it the bot stays off.
3. Restart. Message the bot `/start`, pick a region, then try `/now`. `/stop` unsubscribes.

The bot is open to anyone who finds it. Limits: 500 subscribers, one reply per chat every 3 seconds, and it never echoes what people type.

Behind a corporate proxy that re-signs TLS, Node won't trust the proxy's certificate. Mount the root certificate and point Node at it: uncomment the volume line in `compose.yaml` and set `NODE_EXTRA_CA_CERTS=/certs/corp-root.pem`.

## Public URL (optional)

Set `PUBLIC_URL` to the address the app is served from (for example `https://haze.example.com`). It is exposed at `GET /api/config` as `{ "publicUrl": ... }`, and is `null` when unset.

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
