# DESIGN.md — HazeWatch

Mode: **Operate** (the dashboard); the share card is Persuade-adjacent and the bot reuses both.
The world: **the sky is the reading.** The surface colour of the hero column *is* the current band.
Everything else in this document serves that one idea or stays out of its way.

## 1. The band ramp

Six palettes. Five PSI bands plus `severe`, which only AQI uses. `bands.ts` is the single source; every
colour in the UI derives from it.

The ramp is a **haze palette, not the AQI rainbow** — the colour of the thing the app is named for.
It escalates twice over: the sky deepens as the air worsens, *and* a badge appears at the alert edge.

| Band | key | light sky | light ink | dark sky | dark ink | bar / bar-dark |
|---|---|---|---|---|---|---|
| Good | `good` | `#BFD9EE` | `#1F3346` | `#1E3446` | `#D6E6F3` | `#7FAFD6` / `#4F7FA6` |
| Moderate | `moderate` | `#D6DFD8` | `#2E3A33` | `#2C3631` | `#DCE5DE` | `#A9B9AD` / `#6E8273` |
| Unhealthy | `unhealthy` | `#D6C193` | `#3A2C10` | `#4A3A12` | `#EDDFB6` | `#C8A957` / `#B39550` |
| Very unhealthy | `very_unhealthy` | `#B98552` | `#2A180A` | `#3A2610` | `#F3D9B4` | `#B07A45` / `#B07A45` |
| Hazardous | `hazardous` | `#6E4936` | `#FFF4EA` | `#271812` | `#F6E1D6` | `#7A5240` / `#A0705A` |
| Very unhealthy (AQI) | `severe` | `#8A5C40` | `#FFF3E8` | `#332014` | `#F6DCC8` | `#9A5F3C` / `#B8683F` |

Rules:

- **Light-theme sky luminance steps**: 0.72 → 0.72 → 0.55 → 0.28 → 0.08 (relative luminance). Adjacent
  warning bands must stay separable in lightness, not just hue, so the escalation reads under
  colour-vision deficiency as well as in greyscale.
- **Every ink/surface pair passes WCAG AA (min 4.63:1; most are 7–10:1).** Adding or changing a band
  means re-checking its pair — the palette is a contrast contract, not a swatch list.
- **Do not add a colour.** Red, orange and green are refused: a traffic-light palette is the category
  default and would replace the app's own voice. Escalation comes from depth and from the badge.
- `bar`/`cell` are the *deeper* shades used for the map, the region bars and the calendar — surfaces
  where the sky colour would be too soft at small size.

## 2. Tokens

```
--bg     #F4F6F7     dark #15191C
--ink    #1B2226     dark #E6EBEE
--muted  #5E6A71     dark #8E9AA1
--line   #DDE3E6     dark #2A3136
--sky    #AFB9BF     dark #3A4249   /* the no-band neutral */
--sky-ink, --bar-<key>, --cell-<key>   /* set inline by useSkyTokens() from the active band */
```

- **`--sky` / `--sky-ink` are set at runtime** on `document.documentElement` from the selected region's
  band, with a 600ms transition. The stylesheet values are the fallback for "no band known yet".
- **The neutral no-band sky is deliberately darker than the Good band** (0.48 vs 0.67 luminance) so
  "we don't know yet" can never read as "the air is fine". Never lighten it toward Good.
- `meta[name=theme-color]` follows the sky so the Android status bar matches the surface under it.

## 3. Type

`Bricolage Grotesque Variable`, system-ui fallback. `font-variant-numeric: tabular-nums` on `:root` —
every number in the product is read in comparison with another number.

| Role | Size | Weight | Notes |
|---|---|---|---|
| Verdict (`h1`, Simple) | 36 → 40px @900px | 600 | `line-height: 1.08`, tracking −0.01em |
| Reading (`h1`, Numbers) | 64px | 600 | `line-height: 0.9` |
| Section (`h2`) | **18px** | 600 | Must stay above body 15px; four of them carry the page's scan structure |
| Hero meta | 17px | 400 | the number, its band, the scale switch |
| Body | 15px | 400 | `line-height: 1.45` |
| Caption | 13px | 400 | muted; chart ticks, panel captions |
| Micro | 12px | 400–600 | `legend`, `pol-head`, group headings, footer |

The `h1` is the verdict in Simple and the reading in Numbers. **Every state renders an `h1`** — including
first-run, loading, no-reading and offline, where it is the sr-only "Singapore air quality" — so the
outline is never headless at the moment a new visitor arrives.

## 4. Layout and rhythm

- 8px base unit. Sections are separated by a `1px --line` rule with 24px above it, not by cards.
- **The sky**: `min-height: 60vh`, `flex column`. At ≥900px it becomes `position: sticky; height: 100vh`.
- **Desktop ≥900px**: `.page` is `grid-template-columns: 5fr 6fr` — sky left, evidence right.
- **≥1280px**: the trend chart and the 90-day calendar sit side by side; below that they stack so the
  calendar cells keep their size. (At exactly 1280 the day cells are 18px with a 24px hit area — the
  WCAG 2.5.8 floor. Do not narrow this breakpoint.)
- The hero sits at the **top** of the sky and the leftover height falls below it. Never centre or
  bottom-anchor it.

## 5. Components

- **Sky** — the band-coloured hero column. Holds the header row, badge, hero, notice, advisory and the
  Telegram link. Its colour is the state.
- **Band badge** (`.sky-badge`) — appears whenever the hero's band is a **warning band** (anything from
  Unhealthy up; `isWarningBand` in `bands.ts`), labelled `<band> air`. Keyed on the band rather than on
  `alertEdges` so the badge and the surface colour can never disagree: AQI's 101–150 band
  ("Unhealthy for sensitive groups") is painted with a warning palette but sits below AQI's first alert
  edge. It is the sky *inverted* (`--sky-ink` fill, `--sky` text), so it reads as a discrete state
  rather than a shade and inherits the band's verified contrast pair. Nothing else in the hero is
  allowed to look like an alarm. Note it is *not* the push-alert threshold: Telegram alerts fire on
  `spec.alertEdges` (PSI 101 / AQI 151, the same air on both scales), so AQI 101–150 shows the badge
  without sending an alert.
- **Scale switch** — PSI/AQI, a 20px outline pill inside the hero meta line, deliberately subordinate.
  Its tap pad must not overlap the scale bar's hit strips (`.scale-hit` starts at `top: -2px` for
  exactly this reason).
- **Scale bar** (`HeroSimple`) — segmented in band units, current value marked with a dot, one tooltip
  per segment on hover/tap/focus carrying the band name, range and advice.
- **Gauge + pollutant grid** (`HeroNumbers`) — a vertical band gauge beside the big number, then
  **two groups: Particles (≤2 rows) and Gases (≤4 rows)**, each headed by an uppercase label with a
  full-width hairline so the heading owns both columns. The dominant pollutant is bolded. Never one flat
  list.
- **Region map + rows** — map first (primary), then a compact ranked list. Bars are drawn on a domain
  that **starts and ends on a band edge** (`Regions.tsx`) so the five regions are actually comparable;
  band edges inside the domain are drawn as ticks and the range is stated in the caption.
- **Trend chart** — 24h PM2.5 line, gaps preserved, band start lines dashed and labelled.
- **Calendar** — 90 daily cells, roving tabindex (one tab stop), month labels, band legend.
- **Quiet card** (`.quiet`) — the message surface for loading / no reading / offline. When offline it
  *becomes* the retry button (`.quiet.retry`); there is no separate Retry control.
- **Stale banner** — one line in the sky's own ink with a 6px dot. No card, no coloured side border.

## 6. Motion

One authored moment: the 600ms sky colour change. Control feedback is 120ms. The locate crosshair pulses
while the browser is answering. Everything is gated behind `prefers-reduced-motion: reduce`.

## 7. Accessibility contract

- Body text ≥4.5:1, large text ≥3:1. Ink on a band is derived from that band, never greyed.
- Targets: 44px for primary controls; 40px for region rows; 36px visual / 46px effective for the view
  toggle; a 24px floor everywhere, including the calendar. Effective size = box + any `::after` pad.
- Focus: `2px currentColor` outline, drawn as an SVG overlay on the map zones and calendar cells.
- Live regions: the offer/status notice and the band badge are `role="status"`.
- The calendar is a single tab stop with arrow-key movement; Home/End jump to the ends.
- Links inline in a sentence are exempt from the target minimum.

## 8. Copy rules

- Controls name their action; errors name the problem and the recovery ("Can't reach the server right
  now. Last update 2:00 pm. Tap to retry.").
- The verdict is in the reader's language, never the agency's: "Skip the long run today", not
  "reduce strenuous outdoor exertion".
- Say when something is not official, on the surface that shows it: the AQI explainer sits in the
  footer in AQI mode; the map says its zones are not boundaries.

## 9. States to keep working

loading · first-run picker · geolocation denied · no reading for this region · waiting for first data ·
stale (>120 min) · offline (with last-update time and both an auto-backoff and a tappable retry).

## 10. Refused

Traffic-light red/orange/green · a new colour for a new state · gradients · coloured
`border-left`/`border-right` above 1px · icon fonts or unicode glyphs standing in for icons (icons are
authored SVG) · cards as page structure · a kicker above the heading · centring the hero in the sky's
empty height.
