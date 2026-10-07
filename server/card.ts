import { fileURLToPath } from 'node:url';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { CARD, drawCard } from '../shared/card.ts';
import type { CardCtx, CardInput } from '../shared/card.ts';
import { SCALES } from '../shared/scale.ts';
import type { Region } from '../shared/types.ts';

const FAMILY = 'Bricolage Grotesque Variable';
// The woff2 the web build already ships; the runtime image has it under node_modules.
const FONT = fileURLToPath(new URL('../node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2', import.meta.url));

let registered = false;
function ensureFont() {
  if (registered) return;
  // A failed registration is silent in the logs and obvious in the bytes: Skia falls back to DejaVu,
  // which re-measures every line. Say so rather than ship a card in the wrong face.
  if (!GlobalFonts.registerFromPath(FONT, FAMILY)) console.warn('card font not registered', FONT);
  registered = true;
}

// One entry per region, tagged with the reading it was drawn from, so a hit is always the current card
// and a superseded one is never matched. <=5 entries at ~65 KB.
const cache = new Map<Region, { ts: string; value: number; png: Uint8Array }>();

// A card costs ~54 ms of synchronous Skia work and alert fan-out would draw the same reading once per
// subscriber, so the cache is what keeps an hour's alerts off the event loop's back.
export function renderCard(input: CardInput): Uint8Array {
  const hit = cache.get(input.region);
  if (hit && hit.ts === input.ts && hit.value === input.value) return hit.png;
  ensureFont();
  const canvas = createCanvas(CARD, CARD);
  drawCard(canvas.getContext('2d') as unknown as CardCtx, { spec: SCALES.psi, ...input }); // the bot only quotes PSI
  const png = canvas.toBuffer('image/png');
  cache.set(input.region, { ts: input.ts, value: input.value, png });
  return png;
}
