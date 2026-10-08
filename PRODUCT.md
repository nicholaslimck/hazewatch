# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **The commuter deciding in ten seconds** — one-handed, at 6am, on the way out the door. This is the primary scene and it sets the priority order: verdict first, evidence after.
- **Sensitive groups** — elderly, children, pregnant women, people with heart or lung conditions — who need the advisory and not just the number, and who may be reading on a small screen.
- **Runners and cyclists**, who want the "is today a long-run day?" call and the 24-hour trend behind it.
- **Data-literate residents** who know PSI and want sub-indices, the concentration behind each, and the alternative AQI scale.

Not for: forecasting, official determinations (NEA's site is authoritative), or historical research.

## Product Purpose

A Singapore air-quality dashboard that answers one question — *should I go outside right now?* — in plain language, then offers the evidence underneath. It reads NEA's hourly PSI/PM2.5 feed via data.gov.sg, derives a US-EPA NowCast and AQI from it, and colours the whole screen to match.

Success is a visitor who acts correctly without reading a number: they see the call, they know how bad it is, and they know whether it is getting better — then leave.

## Positioning

Two mechanisms a neighbouring dashboard could not copy truthfully:

1. **The screen is the reading.** The hero's surface colour *is* the active band, so air quality is felt before it is read, and the escalation is the state rather than decoration.
2. **Two scales, one warning.** PSI and AQI are both offered, but the alert thresholds are pinned so that the same air warns on both scales even though the number printed differs. The scale changes what you read, not when you are warned.

## Operating Context

- **Three surfaces, one visual world and one set of band colours:** the web dashboard (`web/`), a Telegram bot — the only push channel (alerts, `/now`, command menu) — and a share card the dashboard renders client-side.
- **Regions** follow NEA's five (north, south, east, west, central); zones are a nearest-station model, not official boundaries.
- **PSI** is NEA's 24-hour average and the default scale, with per-pollutant sub-indices. **AQI** is derived from NEA's hourly PM2.5 via EPA NowCast, so it reacts faster than PSI.
- **Freshness:** 10-minute refresh plus a refetch on tab focus; readings older than 120 minutes are flagged stale.
- Ships as an installable PWA with a service worker, so it must degrade honestly offline.
- A single Bun + Vite + React repo; the Telegram bot shares `shared/` with the web app.

## Capabilities and Constraints

Confirmed:

- Region, scale and view persist in `localStorage`. No accounts, no tracking, no server-side user data.
- Read-only against NEA; the app never writes upstream.
- One page, no routing — everything is reachable by scrolling.
- Alert levels start at PSI 100/200/300 and AQI 150/200/300, chosen so both scales warn on the same air.
- The Telegram bot is the only way the product can tell someone the air turned. That is why the alert thresholds are pinned to both scales at once.

Not claimed / undecided:

- No forecast or prediction capability exists, and none is promised.
- No historical analysis beyond the 90-day grid already shown.

## Brand Commitments

- **Name:** HazeWatch.
- **Voice:** plain, specific, unhurried. The verdict is in the reader's language, never the agency's — "Skip the long run today", not "reduce strenuous outdoor exertion". Say when something is not official, on the surface that shows it.
- **Honesty as identity:** the app would rather say "we don't know yet" or "we couldn't reach the server" than imply calm.

## Evidence on Hand

- NEA hourly PSI/PM2.5 readings via `data.gov.sg`; NEA `regionMetadata` label locations for the five regions.
- US EPA PM2.5 breakpoints, 2024 revision (AQI Technical Assistance Document, May 2024), and the EPA NowCast weighting.
- Official explainer links (PSI/NEA, hourly PM2.5 bands, AQI/EPA, NowCast), checked 2026-10-06.
- `docs/screenshot-desktop.png`, `docs/screenshot-mobile.png`, `docs/icon.svg`.

Absences future work must not fabricate: no testimonials, no benchmark or performance claims, no user counts, no forecast data, no third-party endorsements.

## Product Principles

1. **The verdict is the product.** Answer first, evidence second; a visitor should never have to read a number to act.
2. **Never invent certainty.** Unknown, stale and unreachable are three different states, and each says so in words.
3. **Honest beats reassuring.** Prefer a precise caveat over a comfortable default — including being quiet about an unknown rather than implying the air is fine.
4. **The number stays available.** The plain-language layer is a surface, never a replacement for anyone who wants the reading behind it.
5. **Say the boundary out loud.** Zones are not boundaries; AQI is not an official reading; the app says so where it shows them.

## Accessibility & Inclusion

Sensitive groups are a primary audience, not an edge case: the advisory must be findable, not buried.

- Contrast, target sizes and motion are held to WCAG AA — the reading must survive outdoors, in sunlight, one-handed, on a small screen.
- The dashboard must be operable by keyboard and screen reader across every state, including first-run, loading, no-reading and offline.
- Motion respects `prefers-reduced-motion`.
