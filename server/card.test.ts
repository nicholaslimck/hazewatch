import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GlobalFonts, createCanvas } from '@napi-rs/canvas';
import { renderCard } from './card.ts';
import { CARD, fitFont } from '../shared/card.ts';
import { SCALES } from '../shared/scale.ts';

const TS = '2026-10-06T16:00:00+08:00';
const size = (b: Uint8Array) => {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { width: v.getUint32(16), height: v.getUint32(20) };
};

test('renderCard draws a 1080x1080 PNG in the shipped face', () => {
  const b = renderCard({ scale: 'psi', region: 'central', value: 135, ts: TS });
  assert.deepEqual([...b.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]); // PNG magic
  assert.deepEqual(size(b), { width: 1080, height: 1080 });
  // Registration, not a silent fallback: the layout is measured against this face. A missing font
  // renders in DejaVu and every line re-measures, which no other assertion here would catch.
  assert.ok(GlobalFonts.has('Bricolage Grotesque Variable'));
});

test('renderCard reuses the cached bytes for the same reading, redraws for a new one', () => {
  const a = renderCard({ scale: 'psi', region: 'north', value: 105, ts: TS });
  assert.equal(renderCard({ scale: 'psi', region: 'north', value: 105, ts: TS }), a); // identical object: cache hit
  assert.notEqual(renderCard({ scale: 'psi', region: 'north', value: 105, ts: '2026-10-06T17:00:00+08:00' }), a);
  // The same region and reading on the other scale is a different card, not a cache hit.
  assert.notEqual(renderCard({ scale: 'aqi', region: 'north', value: 105, ts: TS }), a);
});

test('the longest band label shrinks to fit the meta line instead of running off the card', () => {
  renderCard({ scale: 'aqi', region: 'central', value: 130, ts: TS }); // registers the font first
  const g = createCanvas(CARD, CARD).getContext('2d');
  const label = `${SCALES.aqi.band(130).label} \u00b7 6:00 pm, Wed 7 Oct`;
  const width = (p: number) => {
    g.font = `400 ${p}px 'Bricolage Grotesque Variable', system-ui, sans-serif`;
    return g.measureText(label).width;
  };
  // At the 40px it starts at, this label is wider than the column, which is why the line may shrink.
  assert.ok(width(40) > 904, `${label} now measures ${width(40)}px at 40px: it no longer needs to shrink`);
  const px = fitFont(width, 40, 904, 28);
  assert.ok(px >= 28 && px < 40, `picked ${px}px, expected the line to step below 40 but stay legible`);
  assert.ok(width(px) <= 904, `${px}px still overflows at ${width(px)}px`);
});
