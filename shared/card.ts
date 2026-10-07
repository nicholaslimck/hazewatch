import type { Region } from './types.ts';
import type { ScaleSpec } from './scale.ts';
import { fmtDay, fmtTime, regionName } from './format.ts';

// What the card needs beyond the scale: what the site's share button has, and what the server has at
// alert time. Kept separate so the server can build one without importing a scale spec.
export type CardInput = { region: Region; value: number; ts: string };
export type CardOpts = { spec: ScaleSpec } & CardInput;

export const CARD = 1080;
const PAD = 88;
const COLUMN = 904; // text column width, measured from PAD

// The slice of Canvas2D the card uses. Both a browser canvas and @napi-rs/canvas satisfy it, which is
// what lets the site's share card and the bot's card be the same drawing code.
export type CardCtx = {
  fillStyle: string | object;
  textBaseline: string;
  font: string;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
};

export const shareText = (spec: ScaleSpec, region: Region, value: number) =>
  `${regionName(region)} ${spec.name} ${value}, ${spec.band(value).label.toLowerCase()}. ${spec.verdict(value)[1]}`;

// ts is +08:00, so its first 10 chars are the SGT date.
export const shareFilename = (region: Region, ts: string) => `hazewatch-${region}-${ts.slice(0, 10)}.png`;

// Largest px (stepping down by 2 from start) at which widthAt(px) <= max, never below floor.
export function fitFont(widthAt: (px: number) => number, start: number, max: number, floor: number): number {
  let px = start;
  while (px > floor && widthAt(px) > max) px = Math.max(floor, px - 2);
  return px;
}

// Plain Canvas2D calls only, so the browser and the bot cannot drift. The caller supplies the canvas
// (and, in the browser, waits for document.fonts.ready first).
export function drawCard(ctx: CardCtx, { spec, region, value, ts }: CardOpts): void {
  const band = spec.band(value);
  const [line1, line2] = spec.verdict(value);
  ctx.fillStyle = band.color;
  ctx.fillRect(0, 0, CARD, CARD);
  ctx.fillStyle = band.onColor;
  ctx.textBaseline = 'alphabetic';
  const font = (px: number, w: number) => { ctx.font = `${w} ${px}px 'Bricolage Grotesque Variable', system-ui, sans-serif`; };
  const text = (s: string, y: number, w: number, start: number) => {
    const px = fitFont((p) => { font(p, w); return ctx.measureText(s).width; }, start, COLUMN, 40);
    font(px, w);
    ctx.fillText(s, PAD, y);
  };
  text(regionName(region), 160, 600, 56);
  text(`${spec.name} ${value}`, 400, 600, 200);
  text(line1, 560, 400, 72); text(line2, 650, 400, 72);
  text(`${band.label} \u00b7 ${fmtTime(ts)}, ${fmtDay(ts.slice(0, 10))}`, 780, 400, 40);
  text('HazeWatch', CARD - PAD, 600, 36);
}
