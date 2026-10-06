import { test } from 'node:test'; import assert from 'node:assert/strict';
import { buildCells, monthLabels, WEEKS } from './calendar.ts';

// 2026-10-06 is a Tuesday.
const END = '2026-10-06';

test('grid is 14 Monday-first weeks ending with the week holding the end date', () => {
  const cells = buildCells(END, new Map());
  assert.equal(cells.length, WEEKS * 7);
  assert.equal(cells[0].date, '2026-07-06'); // a Monday, 13 weeks before the end week's Monday
  assert.equal(new Date(Date.parse(cells[0].date)).getUTCDay(), 1);
  assert.equal(cells[cells.length - 7].date, '2026-10-05'); // last column starts Monday 5 Oct
  assert.equal(cells[cells.length - 1].date, '2026-10-11'); // and runs to Sunday
});

test('exactly 90 dates are in range, ending on the end date', () => {
  const cells = buildCells(END, new Map());
  const inRange = cells.filter((c) => c.inRange);
  assert.equal(inRange.length, 90);
  assert.equal(inRange[0].date, '2026-07-09');
  assert.equal(inRange[inRange.length - 1].date, END);
  assert.equal(cells.find((c) => c.date === '2026-10-07')!.inRange, false); // after the end date
  assert.equal(cells.find((c) => c.date === '2026-07-08')!.inRange, false); // before the 90-day window
});

test('cells carry values by date, missing days are undefined', () => {
  const cells = buildCells(END, new Map([['2026-10-01', 80], [END, 120]]));
  assert.equal(cells.find((c) => c.date === '2026-10-01')!.value, 80);
  assert.equal(cells.find((c) => c.date === END)!.value, 120);
  assert.equal(cells.find((c) => c.date === '2026-10-02')!.value, undefined);
});

test('an end date on a Sunday fills the last column exactly', () => {
  const cells = buildCells('2026-10-11', new Map());
  assert.equal(cells[cells.length - 1].date, '2026-10-11');
  assert.equal(cells[cells.length - 1].inRange, true);
});

test('month labels sit under the column holding each 1st, plus the first column', () => {
  const labels = monthLabels(buildCells(END, new Map()));
  // Window starts 9 Jul (column 0); 1 Aug is in column 3, 1 Sep in column 8, 1 Oct in column 12.
  assert.deepEqual(labels.map((l) => l.col), [0, 3, 8, 12]);
  assert.equal(labels.length, 4);
});

test('no extra first-column label when a 1st is in column 0 or 1', () => {
  // End 2026-09-28: window starts 1 Jul, which sits in column 0.
  const labels = monthLabels(buildCells('2026-09-28', new Map()));
  assert.equal(labels[0].col, 0);
  assert.equal(labels.filter((l) => l.col === 0).length, 1);
});
