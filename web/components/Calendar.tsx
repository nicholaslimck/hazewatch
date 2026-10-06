import { useState } from 'react';
import type { Region } from '../../shared/types.ts';
import { psiBand } from '../../shared/bands.ts';
import { useHistory } from '../api.ts';
import { fmtDate } from '../format.ts';

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

export function Calendar({ region, tick }: { region: Region; tick: number }) {
  const points = useHistory('90d', 'psi_twenty_four_hourly', region, tick);
  const [picked, setPicked] = useState<{ date: string; value: number } | null>(null);
  if (!points || points.length === 0) return null;

  const byDate = new Map(points.map((p) => [p.ts, p.value]));
  const cells = buildCells(points[points.length - 1].ts, byDate);
  return (
    <section className="card" aria-labelledby="cal-title">
      <h2 id="cal-title">Last 90 days</h2>
      <div className="cal">
        {cells.map((c) => {
          if (!c.inRange) return <span key={c.date} className="cell out" />;
          if (c.value === undefined) return <span key={c.date} className="cell empty" title={`${fmtDate(c.date)}: no data`} />;
          const v = Math.round(c.value);
          const band = psiBand(v);
          const label = `${fmtDate(c.date)}: PSI ${v}`;
          return (
            <button
              key={c.date}
              type="button"
              className="cell"
              style={{ background: band.color }}
              title={label}
              aria-label={`${label}, ${band.label}`}
              onClick={() => setPicked({ date: c.date, value: v })}
            />
          );
        })}
      </div>
      <p className="muted small" aria-live="polite">
        {picked ? `${fmtDate(picked.date)}: PSI ${picked.value} (${psiBand(picked.value).label})` : 'Daily mean PSI. Tap a day to see its value.'}
      </p>
    </section>
  );
}
