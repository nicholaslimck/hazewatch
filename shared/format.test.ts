import { test } from 'node:test'; import assert from 'node:assert/strict';
import { fmtAge, fmtTime, fmtWhen } from './format.ts';
test('fmtWhen dates a reading from over 6 days ago', () => {
  const now = Date.parse('2026-10-27T08:00:00Z'); // Tue 4:00 pm SGT
  assert.equal(fmtWhen('2026-10-13T03:00:00Z', now), `Tue 13 Oct, ${fmtTime('2026-10-13T03:00:00Z')}`); // two Tuesdays ago
  assert.equal(fmtWhen('2026-10-22T03:00:00Z', now), `Thu ${fmtTime('2026-10-22T03:00:00Z')}`); // 5 days ago keeps the weekday
});
test('fmtAge', () => {
  assert.equal(fmtAge(130), '2 hours');
  assert.equal(fmtAge(47 * 60), '47 hours');
  assert.equal(fmtAge(14 * 24 * 60 + 5), '14 days');
});
test('fmtWhen', () => {
  const now = Date.parse('2026-10-12T08:00:00Z'); // Mon 4:00 pm SGT
  assert.equal(fmtWhen('2026-10-11T16:30:00Z', now), fmtTime('2026-10-11T16:30:00Z')); // Mon 12:30 am SGT: same day, though Sunday in UTC
  assert.equal(fmtWhen('2026-10-11T15:30:00Z', now), `Sun ${fmtTime('2026-10-11T15:30:00Z')}`); // Sun 11:30 pm SGT
});
