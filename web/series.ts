import { fmtHour } from '../shared/format.ts';

const HOUR = 3600_000;

// Splits hourly points into runs of consecutive hours, so gaps stay gaps.
export function segments<P extends { ts: string }>(points: P[]): P[][] {
  const out: P[][] = [];
  let prev = NaN;
  for (const p of points) {
    const t = Date.parse(p.ts);
    if (out.length === 0 || t - prev > HOUR) out.push([]);
    out[out.length - 1].push(p);
    prev = t;
  }
  return out;
}

// The missing hours inside a series, said in words ("No data 6pm–10pm."), so a break in a line reads as
// missing data rather than a drawing fault. `ts` need not be sorted or unique.
export function gapNote(ts: string[]): string {
  const times = [...new Set(ts.map((t) => Date.parse(t)))].sort((a, b) => a - b);
  const gaps: string[] = [];
  for (let i = 1; i < times.length; i++) {
    if (times[i] - times[i - 1] <= HOUR) continue;
    const from = new Date(times[i - 1] + HOUR).toISOString();
    const to = new Date(times[i] - HOUR).toISOString();
    gaps.push(from === to ? `at ${fmtHour(from)}` : `${fmtHour(from)}–${fmtHour(to)}`);
  }
  return gaps.length === 0 ? '' : `No data ${gaps.join(', ')}.`;
}

// One y range shared by every region's line, fitted to the readings (padded, in whole tens) rather than
// to whole bands: PSI is a 24-hour average, so on a 100-wide band its day-long lines lay flat. Shared, so a
// higher line is still worse air; band edges inside the range are drawn as hairlines.
export function sharedRange(vals: number[]): [number, number] {
  if (vals.length === 0) return [0, 100];
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const pad = Math.max(max - min, 20) * 0.15;
  return [Math.max(0, Math.floor((min - pad) / 10) * 10), Math.ceil((max + pad) / 10) * 10];
}
