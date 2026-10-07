import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawCard, CARD } from './card.ts';
import type { CardCtx } from './card.ts';
import { SCALES } from './scale.ts';

const TS = '2026-10-06T16:00:00+08:00';

// A stand-in canvas that records what the card asks for, so the layout is assertable without a renderer.
// measureText is deliberately generous: no real line is long enough to shrink.
function recorder() {
  const rec = { rects: [] as number[][], texts: [] as { s: string; x: number; y: number }[], fills: [] as string[], font: '' };
  const ctx = {
    set fillStyle(v: string | object) { rec.fills.push(String(v)); },
    get fillStyle() { return rec.fills[rec.fills.length - 1] ?? ''; },
    textBaseline: '',
    set font(v: string) { rec.font = v; },
    get font() { return rec.font; },
    fillRect: (x: number, y: number, w: number, h: number) => void rec.rects.push([x, y, w, h]),
    fillText: (s: string, x: number, y: number) => void rec.texts.push({ s, x, y }),
    measureText: (s: string) => ({ width: (Number(rec.font.split(' ')[1]?.replace('px', '')) / 8) * s.length }),
  };
  return { ctx: ctx as unknown as CardCtx, rec };
}

test('drawCard paints the band colour behind the six lines', () => {
  const { ctx, rec } = recorder();
  drawCard(ctx, { spec: SCALES.psi, region: 'central', value: 135, ts: TS });
  const band = SCALES.psi.band(135);
  const [line1, line2] = SCALES.psi.verdict(135);
  assert.deepEqual(rec.rects, [[0, 0, CARD, CARD]]);
  assert.equal(rec.fills[0], band.color); // background
  assert.equal(rec.fills[1], band.onColor); // text
  const drawn = rec.texts.map((t) => t.s);
  assert.equal(drawn.length, 6);
  assert.deepEqual(drawn.slice(0, 4), ['Central', 'PSI 135', line1, line2]);
  assert.match(drawn[4], /^Unhealthy \u00b7 4:00 pm, /);
  assert.equal(drawn[5], 'HazeWatch');
  assert.ok(rec.texts.every((t) => t.x === 88), 'every line starts at the same left edge');
});

test('drawCard follows the band of the value it is given', () => {
  const { ctx, rec } = recorder();
  drawCard(ctx, { spec: SCALES.psi, region: 'east', value: 250, ts: TS });
  assert.equal(rec.fills[0], SCALES.psi.band(250).color);
  assert.equal(rec.texts[0].s, 'East');
  assert.ok(rec.texts.some((t) => t.s.startsWith('Very unhealthy \u00b7 ')));
});
