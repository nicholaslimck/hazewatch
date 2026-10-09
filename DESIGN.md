---
name: HazeWatch
description: Singapore air quality, where the screen itself is the reading.
colors:
  cool-paper: "#F4F6F7"
  wet-slate: "#1B2226"
  rain-grey: "#5E6A71"
  fog-line: "#DDE3E6"
  overcast: "#AFB9BF"
  clear-day: "#BFD9EE"
  distant-haze: "#D6DFD8"
  haze-gold: "#D6C193"
  deep-haze: "#B98552"
  smoke-umber: "#6E4936"
  burnt-haze: "#8A5C40"
  ink-on-clear-day: "#1F3346"
  ink-on-distant-haze: "#2E3A33"
  ink-on-haze-gold: "#3A2C10"
  ink-on-deep-haze: "#2A180A"
  ink-on-smoke-umber: "#FFF4EA"
  ink-on-burnt-haze: "#FFF3E8"
  daylight-blue: "#5785AB"
  sage: "#768579"
  ochre: "#9B7D28"
  clay: "#AB7641"
  peat: "#7A5240"
  burnt-clay: "#9A5F3C"
  surface-dark: "#15191C"
  wet-slate-dark: "#E6EBEE"
  rain-grey-dark: "#8E9AA1"
  fog-line-dark: "#2A3136"
  overcast-dark: "#3A4249"
typography:
  display:
    fontFamily: "Bricolage Grotesque Variable, system-ui, sans-serif"
    fontSize: "clamp(36px, 4vw, 40px)"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Bricolage Grotesque Variable, system-ui, sans-serif"
    fontSize: "64px"
    fontWeight: 600
    lineHeight: 0.9
  stat:
    fontFamily: "Bricolage Grotesque Variable, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.2
  title:
    fontFamily: "Bricolage Grotesque Variable, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
  meta:
    fontFamily: "Bricolage Grotesque Variable, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.45
  body:
    fontFamily: "Bricolage Grotesque Variable, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
  advice:
    fontFamily: "Bricolage Grotesque Variable, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  small:
    fontFamily: "Bricolage Grotesque Variable, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.35
  label:
    fontFamily: "Bricolage Grotesque Variable, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    letterSpacing: "0.06em"
rounded:
  dot: "2px"
  track: "3px"
  cell: "4px"
  row: "6px"
  card: "8px"
  pill: "999px"
spacing:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  band-badge:
    backgroundColor: "{colors.wet-slate}"
    textColor: "{colors.cool-paper}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
  quiet-card:
    backgroundColor: "{colors.cool-paper}"
    textColor: "{colors.wet-slate}"
    rounded: "{rounded.card}"
    padding: "12px 14px"
  view-toggle:
    backgroundColor: "{colors.cool-paper}"
    textColor: "{colors.wet-slate}"
    rounded: "{rounded.pill}"
    padding: "2px"
    height: "36px"
  region-row:
    backgroundColor: "{colors.cool-paper}"
    textColor: "{colors.wet-slate}"
    rounded: "{rounded.row}"
    height: "40px"
  calendar-cell:
    backgroundColor: "{colors.ochre}"
    textColor: "{colors.wet-slate}"
    rounded: "{rounded.cell}"
    size: "18px"
---

# Design System: HazeWatch

## Overview

**Creative North Star: "The Sky Is the Reading"**

HazeWatch does not draw a dashboard about air quality; it turns the surface into the air. The hero column's background colour *is* the active band, set at runtime from NEA's reading and crossfaded over 600ms. At PSI 148 the whole left column is haze gold with dark-brown ink; at 352 it is smoke umber. Nothing else on the page is allowed to compete with that, because the colour is not decoration — it is the datum.

The second governing idea is honesty of state. Four distinct conditions look different and say different things: we don't know yet, we have no reading for your region, this reading is stale, and we can't reach the server. The "unknown" surface is deliberately darker than the Good band so it can never be mistaken for good news. The palette refuses the AQI traffic-light rainbow and uses a haze ramp instead — sage, ochre, clay, peat — the colour of the thing the app is named for. Escalation therefore has to come from depth and from one discrete alarm, never from hue.

The system is otherwise quiet: flat surfaces, hairline rules instead of cards, tabular numerals throughout so any two numbers can be compared, and exactly one authored motion moment. Density is low in the hero and moderate in the evidence panels below it; the page is built for a glance, and the detail is there for whoever stays.

**Key Characteristics:**

- The hero surface colour is the live reading; the neutral no-band surface is darker than Good on purpose.
- A haze ramp, not a traffic light; escalation by depth, never by a new hue.
- One alarm only: a single badge that appears from the Unhealthy band up.
- Every ink/surface pair is a checked WCAG AA pair (min 4.63:1).
- Hairlines and whitespace instead of cards; no shadows anywhere.
- One authored motion moment (the 600ms sky crossfade); every control responds in 120ms.
- Tabular numerals on every figure in the product.

## Colors

A haze palette: two pale start-of-day surfaces, then four progressively deeper earth tones, with a parallel set of deeper shades for small marks.

### Primary

- **Clear Day** (#BFD9EE): the Good sky. The only cool, high-luminance surface in the ramp; it reads as weather, not as a signal.
- **Distant Haze** (#D6DFD8): the Moderate sky. A desaturated grey-green, deliberately the *lightest* surface — Moderate gets the calmest treatment of the whole ramp.
- **Haze Gold** (#D6C193): the Unhealthy sky. Warm, dusty, and still comfortable; the first band that earns a badge.
- **Deep Haze** (#B98552): the Very unhealthy sky. Clearly darker and more saturated; the page starts to close in.
- **Smoke Umber** (#6E4936): the Hazardous sky. Dark enough that the ink pair flips to light — the only band where the hero reads as genuinely dark.
- **Burnt Haze** (#8A5C40): the AQI-only "Very unhealthy" sky, sitting between Deep Haze and Smoke Umber.

### Secondary

- **Daylight Blue / Sage / Ochre / Clay / Peat / Burnt Clay** (#5785AB · #768579 · #9B7D28 · #AB7641 · #7A5240 · #9A5F3C): the deeper per-band shades used for the map zones, the region bars and the 90-day calendar cells — every surface where the sky tone would be too soft at small size. They map one-to-one to the six skies. Each is deepened enough to clear **3:1 against the Fog Line track** it sits on (they were 1.58–1.84:1, invisible at the pale end), so the at-a-glance comparison the bars exist for survives low vision — hue held, lightness dropped.

### Neutral

- **Cool Paper** (#F4F6F7): the page and the evidence column.
- **Wet Slate** (#1B2226): body ink and the badge fill.
- **Rain Grey** (#5E6A71): captions, legends, secondary text.
- **Fog Line** (#DDE3E6): hairlines and the region-bar tracks.
- **Overcast** (#AFB9BF): the **no-band** sky — the surface shown before any reading is known.
- **Surface Dark / Ink Dark / Rain Grey Dark / Line Dark / Overcast Dark** (#15191C · #E6EBEE · #8E9AA1 · #2A3136 · #3A4249): the dark-scheme neutral set — page ground, ink, secondary text, hairlines and the no-band sky. Dark mode is a composed second palette, not an inversion; the six band skies are re-cut as deep grounds and carry their own verified ink pairs (see the sidecar).

### Named Rules

**The Haze Rule.** There is no traffic-light palette. Red, orange and green are refused at every level; escalation comes from depth, saturation and the badge. A new severity state earns a deeper haze tone, never a new hue.

**The Contract Rule.** Every ink/surface pair is a WCAG AA pair (min 4.63:1, most 7–10:1). A band is not a swatch; it is a contrast contract, and adding or changing one means re-checking its pair before it ships.

**The Darker-Than-Good Rule.** The no-band Overcast surface must stay clearly darker than Clear Day (0.48 vs 0.67 luminance, measured as relative luminance). "We don't know yet" must never read as "the air is fine". Never lighten it toward Good.

**The Marks-Clear-Three Rule.** A mark that encodes a value on a track — the region-bar and calendar fills — clears **3:1 against the track it sits on**, not merely against the page. A pale fill that vanishes into its own track has stopped being a mark.

## Typography

**Display Font:** Bricolage Grotesque Variable (with system-ui, sans-serif)
**Body Font:** Bricolage Grotesque Variable (with system-ui, sans-serif)

**Character:** One variable grotesque across the whole product, humanist-soft at display size and plain at text size. `font-variant-numeric: tabular-nums` is set on `:root`, because every number in this product exists to be compared with another number. There is no second family and no mono; a mono would imply code where the content is measurement. Type sizes are fixed in `px` on purpose — the tabular layout and the type ramp assume a stable rhythm — so the page scales with browser zoom rather than the OS text-size preference; a deliberate exception, not an oversight.

### Hierarchy

- **Display** (600, clamp 36→40px, 1.08, −0.01em): the verdict in Simple view — "Hazy. Skip the long run today." This is the page's `h1` and its largest text on mobile.
- **Headline** (600, 64px, 0.9): the reading in Numbers view, set beside a vertical band gauge.
- **Stat** (600, 20px, 1.2): the pollutant concentration in a Numbers row — the large figure in a dense line.
- **Title** (600, 18px): the section headings — "Around Singapore", "Last 24 hours", "Last 90 days". Must stay clearly above body size; these headings carry the page's scan structure.
- **Meta** (400, 17px, 1.45): the hero's number line — the reading, its band name and the scale switch, sitting directly under the verdict.
- **Body** (400, 15px, 1.45): the base text size (`:root`).
- **Advice** (400, 14px, 1.45): the sky's single advisory sentence, capped at 68ch.
- **Small** (400, 13px, 1.35): captions, region rows, the footer, and the badge and toggle segments — the floor of the scale.
- **Label** (600, 12px, 0.06em, uppercase): group headings ("Particles", "Gases"), legends, chart reference labels.

### Named Rules

**The Verdict Rule.** The `h1` is the answer in the reader's language, never the agency's. It is the verdict in Simple view and the reading in Numbers view, and **every** state renders one — first-run, loading, no-reading and offline fall back to an `sr-only` "Singapore air quality" so the outline is never headless at the moment a new visitor arrives.

## Layout

Base unit 8px. The page is a two-column split on desktop and a single column below 900px.

- **`.page`** at ≥900px is `grid-template-columns: 5fr 6fr` — the sky on the left, the evidence on the right.
- **The sky** is `min-height: 60vh` and a flex column on mobile; from 900px it becomes `position: sticky; height: 100vh`, so the reading stays with the reader while the evidence scrolls.
- **The evidence column** (`.rest`) pads 24/18 on mobile and 32/40 on desktop. Sections are separated by a 1px Fog Line rule with 24px above and below it — not by cards.
- **≥1280px** the 24-hour chart and the 90-day calendar sit side by side (`1fr 1fr`, 32px gap). Below that they stack full width so the calendar cells keep their size. At exactly 1280 the day cells render 18px with a 24px hit area — the WCAG 2.5.8 floor — so this breakpoint is a floor, not a preference.
- **Targets:** 44px for primary controls (locate, share, region select, picker buttons), 40px for region rows, 36px visual / 46px effective for the view toggle, and a 24px minimum everywhere including the 90-day grid. Effective size means the box plus any `::after` pad.

### Named Rules

**The Top-Anchored Rule.** The hero sits at the top of the sky and the leftover viewport height falls *below* it. The hero is never centred and never bottom-anchored — the empty sky is the surface the reading colours, not a mat for centring content.

## Elevation & Depth

**No shadows. At all.** There is no `box-shadow` vocabulary in this system; depth is entirely tonal. Hierarchy comes from the sky's colour depth, from Fog Line hairlines between sections, and from whitespace. The one apparent exception is the calendar's selected day, which uses an inset `box-shadow` purely as a 2px ring — an outline drawn with a shadow, not a lift.

Dark mode is a genuine second palette rather than a filter: surfaces go to Surface Dark (#15191C) and the six sky tones are re-cut as deep, desaturated grounds, each keeping its own verified ink pair.

### Named Rules

**The Flat Rule.** Nothing lifts, floats or glows. If an element needs to stand out it earns a deeper tone, a hairline, or weight — never a shadow.

## Shapes

The form language is soft rectangles with one pill:

- **Pills (999px)** are for *state*: the view toggle, the PSI/AQI scale switch, the band badge. Anything that reports a current mode is a pill.
- **Cards (8px)** are for the two message surfaces — the quiet card and the region picker. Nothing else is a card.
- **Rows (6px)** and **cells (4px)** take progressively tighter corners as they get smaller and denser.
- **Tracks (3px)** — the region-bar and scale-bar tracks — are near-square so they read as measurement, not as buttons.
- **Dots (2px)** — the legend swatch and the "now" dot — the smallest step of the radius scale.

Borders are 1px hairlines in Fog Line, never coloured. Icons are authored SVG at a consistent 2px stroke, never an icon font and never a unicode glyph.

### Named Rules

**The Quiet Corner Rule.** Radius is a size signal, not a style: smaller element, smaller radius. Pills are reserved for state so that a pill always means "this is the current mode".

## Components

### Band badge

The system's only alarm. Inverted out of the sky — the badge is filled with the hero's ink and lettered in the hero's surface colour, so it always carries the band's own verified contrast pair and never needs a colour of its own.

- **Shape:** pill (999px), 3px 10px padding, 13px/600.
- **When:** renders whenever the hero's band is a warning band — anything from Unhealthy up (`isWarningBand` in `shared/bands.ts`), labelled `<band> air`.
- **Hover / Focus:** not interactive; it is a `role="status"` announcement, not a control.

### Quiet card

The single message surface, reused for loading, "no reading for this region", and offline.

- **Shape:** 8px radius, 1px Fog Line hairline, Cool Paper ground, 12px 14px padding.
- **Retry variant:** when offline the card *becomes* the control (`.quiet.retry`) — same box, now a `<button>`, no separate Retry control beside it. Hover and active tint the ground with `currentColor` at 6% and 12%.

### View toggle & scale switch

Two pills that report mode.

- **View toggle:** 36px tall, 2px padding, 13px/600 segments; the checked segment inverts to Wet Slate on the sky's ink. A `::after` pad extends the tap area to 46px while the visual stays 36px.
- **Scale switch (PSI/AQI):** deliberately smaller — a 20px outline-only pill in the hero meta line, subordinate to the toggle. Its tap pad must not overlap the scale bar's hit strips; `.scale-hit` starts at `top: -2px` for exactly that reason.

### Region map & rows

- **Map first.** Five hand-built SVG zones coloured by the band's marks shade (Secondary), each a focusable `role="button"` with an authored 2px stroke; selection and keyboard focus are non-interactive overlays drawn after every zone.
- **Rows second,** compact: a ranked list under the map, 40px minimum height, a 6px track, and a band marks-shade fill on a domain that **starts and ends on a band edge** so the five regions are actually comparable. The fill clears 3:1 against the track (Marks-Clear-Three Rule); band edges inside the domain are drawn as 1px ticks, and the caption states the range.

### Numbers: gauge & pollutant grid

- A 14px vertical band gauge beside the 64px reading.
- The pollutant list is **two groups — Particles (≤2 rows) and Gases (≤4 rows)** — each headed by an uppercase label with a full-width hairline so the heading owns both columns. The dominant pollutant is bolded. Never one flat list of six.

### Calendar

- 90 daily cells, 4px radius, filled with the band marks shade, one tab stop for the whole grid with arrow-key movement (Home/End jump to the ends).
- The current day carries an outer 2px ring; the selected day an inner ring, so the three states stay distinct.
- A band legend sits beneath, because the cells encode by colour.

### Trend chart

- 24-hour PM2.5 line, gaps preserved as gaps, band start lines dashed in Rain Grey and labelled, ticks below the plot so a label never covers the data.

### Named Rules

**The One Alarm Rule.** The band badge is the only element in the hero permitted to look like an alarm. If something else starts looking urgent, it is wrong.

**The Card-Is-A-Message Rule.** Only the quiet card and the region picker are cards. Sections are separated by hairlines, not by wrapping them in boxes.

## Do's and Don'ts

### Do:

- **Do** keep the badge and the sky colour in agreement by keying the badge on the band (`isWarningBand`), not on the alert edge.
- **Do** re-check the ink/surface contrast pair when any band colour changes; the floor is 4.63:1 and most pairs run 7–10:1.
- **Do** keep a value-encoding mark at least 3:1 against the track it sits on, not just the page.
- **Do** keep the neutral no-band sky darker than the Good band.
- **Do** state the scale's real range in place when bars are drawn on a narrowed domain ("The bars share one scale, 100–200").
- **Do** name the action and the recovery in errors: "Can't reach the server right now. Last update 2:00 pm. Tap to retry."
- **Do** render an `h1` in every state, even when it has to be `sr-only`, and keep it first in the DOM so the outline starts at level 1.
- **Do** keep every state honest and distinct: unknown, no reading, stale (>120 min) and offline are four different screens.
- **Do** use tabular numerals for every figure.

### Don't:

- **Don't** introduce a traffic-light red/orange/green, or a new colour for a new severity state.
- **Don't** use a coloured `border-left` or `border-right` above 1px on any card, row or alert — the stale banner is one line of text and a 6px dot for exactly this reason.
- **Don't** add shadows, glows, gradients or glass; depth is tonal.
- **Don't** centre or bottom-anchor the hero in the sky's leftover height.
- **Don't** add a kicker or eyebrow above a heading.
- **Don't** put icon fonts, emoji or unicode glyphs in place of icons; icons are authored SVG on a consistent stroke.
- **Don't** let a control's box fall under 24px without an `::after` pad to carry it there, and don't measure target size without counting that pad.
- **Don't** wrap sections in cards, and never nest cards.
- **Don't** let a fill and its track end up within 3:1 of each other.

### Refused

- **A PM2.5 scale.** PSI and AQI are the only scales. PM2.5 is a pollutant rather than an index, so it stays a reading inside Numbers and the trend chart, never a third position on the scale switch. NEA's hourly PM2.5 bands sit on different edges from PSI's, so the same air can read Unhealthy on PSI and calmer on PM2.5. A scale that lets the sky look calm on a day PSI calls unhealthy is refused: it breaks the One Alarm Rule, and the screen must never understate the air.
