import { useState } from 'react';
import type { Region } from '../../shared/types.ts';
import { BANDS, psiBand } from '../../shared/bands.ts';
import { useHistory } from '../api.ts';
import { fmtDay, fmtMonth, todaySgt } from '../format.ts';

const DAY = 86_400_000;
const WEEKS = 14;

type Cell = { date: string; value: number | undefined; inRange: boolean };

// Monday-first weeks, one column per week, ending with the week that holds `end` (YYYY-MM-DD).
function buildCells(end: string, byDate: Map<string, number>): Cell[] {
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
function monthLabels(cells: Cell[]): { col: number; text: string }[] {
  const starts = cells.flatMap((c, i) => (c.inRange && c.date.endsWith('-01') ? [{ col: Math.floor(i / 7), text: fmtMonth(c.date) }] : []));
  const first = cells.find((c) => c.inRange);
  if (first && !starts.some((s) => s.col <= 1)) starts.unshift({ col: 0, text: fmtMonth(first.date) });
  return starts;
}

export function Calendar({ region, tick }: { region: Region; tick: number }) {
  const points = useHistory('90d', 'psi_twenty_four_hourly', region, tick);
  const [picked, setPicked] = useState<{ date: string; value: number } | null>(null);
  if (!points || points.length === 0) return null;

  const byDate = new Map(points.map((p) => [p.ts, p.value]));
  const cells = buildCells(points[points.length - 1].ts, byDate);
  const today = todaySgt();
  return (
    <section aria-labelledby="cal-title">
      <h2 id="cal-title">Last 90 days</h2>
      <div className="cal">
        {cells.map((c) => {
          const cls = c.date === today ? ' today' : '';
          if (!c.inRange) return <span key={c.date} className="cell out" />;
          if (c.value === undefined) return <span key={c.date} className={`cell empty${cls}`} title={`${fmtDay(c.date)}: no data`} />;
          const v = Math.round(c.value);
          const label = `${fmtDay(c.date)}: PSI ${v}`;
          return (
            <button
              key={c.date}
              type="button"
              className={`cell${cls}`}
              style={{ background: `var(--cell-${psiBand(v).key})` }}
              title={label}
              aria-label={label}
              onClick={() => setPicked({ date: c.date, value: v })}
            />
          );
        })}
      </div>
      <div className="months" aria-hidden="true">
        {monthLabels(cells).map((m) => <span key={m.col} style={{ gridColumn: m.col + 1 }}>{m.text}</span>)}
      </div>
      <p className="caption" aria-live="polite">
        {picked ? `${fmtDay(picked.date)}: PSI ${picked.value}, ${psiBand(picked.value).label.toLowerCase()}` : 'Daily mean PSI. Tap a day to see its value.'}
      </p>
      <ul className="legend">
        {BANDS.map((b) => (
          <li key={b.key}><span className="swatch" style={{ background: `var(--cell-${b.key})` }} />{b.label}</li>
        ))}
      </ul>
    </section>
  );
}
