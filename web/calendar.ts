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

// Month label under the week column holding the 1st; the first column gets one too unless a 1st is right next to it.
export function monthLabels(cells: Cell[]): { col: number; text: string }[] {
  const starts = cells.flatMap((c, i) => (c.inRange && c.date.endsWith('-01') ? [{ col: Math.floor(i / 7), text: fmtMonth(c.date) }] : []));
  const first = cells.find((c) => c.inRange);
  if (first && !starts.some((s) => s.col <= 1)) starts.unshift({ col: 0, text: fmtMonth(first.date) });
  return starts;
}
