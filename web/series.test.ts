import { test } from 'node:test'; import assert from 'node:assert/strict';
import { gapNote, segments } from './series.ts';
import { fmtHour } from '../shared/format.ts';
const at = (h: number) => `2026-10-12T${String(h).padStart(2, '0')}:00:00+08:00`;
test('segments split at gaps', () => {
  assert.deepEqual(segments([1, 2, 5, 6].map((h) => ({ ts: at(h) }))).map((s) => s.length), [2, 2]);
});
test('gapNote', () => {
  assert.equal(gapNote([at(1), at(2), at(3)]), '');
  assert.equal(gapNote([at(17), at(23), at(17)]), `No data ${fmtHour(at(18))}–${fmtHour(at(22))}.`); // duplicates across regions
  assert.equal(gapNote([at(4), at(6)]), `No data at ${fmtHour(at(5))}.`);
});
test('sharedRange', async () => {
  const { sharedRange } = await import('./series.ts');
  assert.deepEqual(sharedRange([129, 174, 150]), [120, 190]); // padded by 15% of the spread, whole tens
  assert.deepEqual(sharedRange([40, 41]), [30, 50]); // a flat day still gets a 20-point window
  assert.deepEqual(sharedRange([2]), [0, 10]); // never below zero
  assert.deepEqual(sharedRange([]), [0, 100]);
});
