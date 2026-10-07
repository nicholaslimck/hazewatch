import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GlobalFonts } from '@napi-rs/canvas';
import { renderCard } from './card.ts';

const TS = '2026-10-06T16:00:00+08:00';
const size = (b: Uint8Array) => {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { width: v.getUint32(16), height: v.getUint32(20) };
};

test('renderCard draws a 1080x1080 PNG in the shipped face', () => {
  const b = renderCard({ region: 'central', value: 135, ts: TS });
  assert.deepEqual([...b.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]); // PNG magic
  assert.deepEqual(size(b), { width: 1080, height: 1080 });
  // Registration, not a silent fallback: the layout is measured against this face. A missing font
  // renders in DejaVu and every line re-measures, which no other assertion here would catch.
  assert.ok(GlobalFonts.has('Bricolage Grotesque Variable'));
});

test('renderCard reuses the cached bytes for the same reading, redraws for a new one', () => {
  const a = renderCard({ region: 'north', value: 105, ts: TS });
  assert.equal(renderCard({ region: 'north', value: 105, ts: TS }), a); // identical object: cache hit
  assert.notEqual(renderCard({ region: 'north', value: 105, ts: '2026-10-06T17:00:00+08:00' }), a);
});
