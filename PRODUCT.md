# PRODUCT.md — HazeWatch

## What it is

A Singapore air-quality dashboard. It answers one question — *should I go outside right now?* — in
plain language, then offers the evidence underneath. It reads NEA's hourly PSI/PM2.5 feed (via
data.gov.sg), derives a US-EPA NowCast and AQI from it, and colours the whole screen to match.

Live: `hazewatch.limspot.org`. Source is a single Bun + Vite + React repo.

## Who it is for

- **The commuter deciding in ten seconds**, one-handed, at 6am, on the way out the door. This is the
  primary scene and it sets the priority order: verdict first, evidence after.
- **Sensitive groups** — elderly, children, pregnant women, people with heart or lung conditions — who
  need the advisory and not just the number, and who may be reading on a small screen.
- **Runners and cyclists**, who want the "is today a long-run day?" call and the 24-hour trend behind it.
- **Data-literate residents** who know PSI and want sub-indices, the concentration behind each, and the
  alternative AQI scale.

Not for: forecasting (HazeWatch reports what NEA measured, never a prediction), official
determinations (NEA's site is authoritative), or historical research.

## Modes and surfaces

| Surface | Mode | Notes |
|---|---|---|
| Web dashboard (`web/`) | **Operate** | The product. Simple/Numbers views × PSI/AQI scales. |
| Telegram bot | **Operate** | The only push channel: alerts when a region turns unhealthy, `/now`, command menu. |
| Share card | **Persuade-adjacent** | A PNG the dashboard renders client-side, sent by `navigator.share` or messaged by the bot. |

Three surfaces, one visual world and one set of band colours.

## The model

- **Regions:** NEA's five (north, south, east, west, central). Zones are a nearest-station model, not
  official boundaries, and the UI says so on the map itself.
- **PSI:** NEA's 24-hour average, the default scale, with per-pollutant sub-indices.
- **AQI:** US EPA index computed from NEA's hourly PM2.5 via EPA NowCast (a 12-hour weighted mean, so it
  reacts faster than PSI). It is explicitly labelled as not an official reading.
- **Alert levels** start at PSI 100 / 200 / 300 and AQI 150 / 200 / 300 — chosen so both scales warn on
  the same air, not the same number.
- **Freshness:** 10-minute refresh, plus a refetch on tab focus. Data older than 120 minutes is
  flagged as stale.

## Constraints

- No accounts, no tracking, no server-side user data. Region, scale and view live in `localStorage`.
- Read-only against NEA; the app never writes upstream.
- One page, no routing. Everything is reachable by scrolling.
- Ships as an installable PWA with a service worker; must degrade honestly offline.
- The Telegram bot is the only way the product can tell someone the air turned. That capability is the
  reason alert thresholds are pinned to both scales at once.

## Product truths the design must not break

1. The verdict is the product. A visitor should get the answer from the first screen without reading a
   number.
2. The screen is the warning. Colour carries state, so it must escalate with severity and must never
   read as "fine" when the reading is unknown.
3. Never invent certainty. Unknown data, stale data and unreachable servers each say so in words.
4. The number is always available for anyone who wants it — the plain-language layer is a surface, not
   a replacement.

## Related

- `DESIGN.md` — the visual world, tokens and component rules.
- `.impeccable/critique/` — timestamped design reviews.
