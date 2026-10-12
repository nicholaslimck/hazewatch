import { test } from 'node:test'; import assert from 'node:assert/strict';
import { fmtTime, fmtWhen } from './format.ts';
test('fmtWhen', () => {
  const now = Date.parse('2026-10-12T08:00:00Z'); // Mon 4:00 pm SGT
  assert.equal(fmtWhen('2026-10-11T16:30:00Z', now), fmtTime('2026-10-11T16:30:00Z')); // Mon 12:30 am SGT: same day, though Sunday in UTC
  assert.equal(fmtWhen('2026-10-11T15:30:00Z', now), `Sun ${fmtTime('2026-10-11T15:30:00Z')}`); // Sun 11:30 pm SGT
});
