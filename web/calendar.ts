import { fmtMonth } from '../shared/format.ts';

const DAY = 86_400_000;
export const WEEKS = 14;

export type Cell = { date: string; value: number | undefined; inRange: boolean };

// Monday-first weeks, one column per week, ending with the week that holds `end` (YYYY-MM-DD).
export function buildCells(end: string, byDate: Map<string, number>): Cell[] {
  const endMs = Date.parse(end); // UTC midnight
  const startMs = endMs - 89 * DAY; // 90 dates inclusive, matching the server window
  const weekday = (new Date(endMs).getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  const gridStart = endMs - weekday * DAY - (WEEKS - 1) * 7 * DAY;
  const cells: Cell[] = [];
  for (let i = 0; i < WEEKS * 7; i++) {
    const ms = gridStart + i * DAY;
    const date = new Date(ms).toISOString().slice(0, 10);
    cells.push({ date, value: byDate.get(date), inRange: ms >= startMs && ms <= endMs });
  }
  return cells;
}

// A day is reachable by keyboard when it is inside the 90-day window and has a reading. Padded edges
// and no-data days render as plain spans, so they are skipped rather than being another tab stop.
export function isFocusable(c: Cell): boolean {
  return c.inRange && c.value !== undefined;
}

// Roving-tabindex movement: walk `step` cells at a time (1 = next/previous day, 7 = the same weekday a
// week over) until a focusable cell is found, so an arrow key never lands on a padded or empty day.
// Returns the index into `cells`, or -1 when the walk runs off the grid.
export function stepFocus(cells: Cell[], from: number, step: number): number {
  for (let i = from + step; i >= 0 && i < cells.length; i += step) {
    if (isFocusable(cells[i])) return i;
  }
  return -1;
}

// Where the grid's single tab stop rests before anyone has navigated it: the end date when it has a
// reading, else the most recent day that does. -1 when nothing in the window has data.
export function defaultFocusIndex(cells: Cell[], end: string): number {
  const atEnd = cells.findIndex((c) => c.date === end && isFocusable(c));
  if (atEnd >= 0) return atEnd;
  for (let i = cells.length - 1; i >= 0; i--) if (isFocusable(cells[i])) return i;
  return -1;
}

// Month label under the week column holding the 1st; the first column gets one too unless a 1st is right next to it.
export function monthLabels(cells: Cell[]): { col: number; text: string }[] {
  const starts = cells.flatMap((c, i) => (c.inRange && c.date.endsWith('-01') ? [{ col: Math.floor(i / 7), text: fmtMonth(c.date) }] : []));
  const first = cells.find((c) => c.inRange);
  if (first && !starts.some((s) => s.col <= 1)) starts.unshift({ col: 0, text: fmtMonth(first.date) });
  return starts;
}
