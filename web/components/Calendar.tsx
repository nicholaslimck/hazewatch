import { useEffect, useRef, useState } from 'react';
import type { Region } from '../../shared/types.ts';
import type { ScaleSpec } from '../../shared/scale.ts';
import { useHistory } from '../api.ts';
import type { HistoryPoint } from '../api.ts';
import { fmtDay, todaySgt } from '../../shared/format.ts';
import { buildCells, monthLabels } from '../calendar.ts';

export function Calendar({ region, tick, spec }: { region: Region; tick: number; spec: ScaleSpec }) {
  const fresh = useHistory('90d', spec.history.metric, region, tick);
  // While a new region or scale loads, keep drawing the last grid (dimmed) with the spec it was drawn with,
  // so the page doesn't collapse and jump.
  const last = useRef<{ points: HistoryPoint[]; spec: ScaleSpec } | null>(null);
  if (fresh && fresh.length > 0) last.current = { points: fresh, spec };
  const loading = fresh === null && last.current !== null;
  const shown = fresh && fresh.length > 0 ? { points: fresh, spec } : loading ? last.current : null;

  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => setPicked(null), [region, spec]);
  if (shown === null) return null;

  const s = shown.spec;
  const byDate = new Map(shown.points.map((p) => [p.ts, s.history.convert(p.value)]));
  const cells = buildCells(shown.points[shown.points.length - 1].ts, byDate);
  const today = todaySgt();
  const pickedValue = picked === null ? undefined : byDate.get(picked);
  const describe = (date: string, v: number) => `${fmtDay(date)}: ${s.name} ${v}, ${s.band(v).label.toLowerCase()}`;
  return (
    <section aria-labelledby="cal-title" aria-busy={loading} className={loading ? 'loading' : undefined}>
      <h2 id="cal-title">Last 90 days</h2>
      <div className="cal">
        {cells.map((c) => {
          const cls = c.date === today ? ' today' : '';
          if (!c.inRange) return <span key={c.date} className="cell out" />;
          if (c.value === undefined) return <span key={c.date} className={`cell empty${cls}`} title={`${fmtDay(c.date)}: no data`} />;
          const v = Math.round(c.value);
          const isPicked = c.date === picked;
          return (
            <button
              key={c.date}
              type="button"
              className={`cell${cls}${isPicked ? ' picked' : ''}`}
              style={{ background: `var(--cell-${s.band(v).key})` }}
              title={describe(c.date, v)}
              aria-label={describe(c.date, v)}
              aria-pressed={isPicked}
              onClick={() => setPicked(isPicked ? null : c.date)}
            />
          );
        })}
      </div>
      <div className="months" aria-hidden="true">
        {monthLabels(cells).map((m) => <span key={m.col} style={{ gridColumn: m.col + 1 }}>{m.text}</span>)}
      </div>
      <p className="caption" aria-live="polite">
        {picked !== null && pickedValue !== undefined
          ? describe(picked, Math.round(pickedValue))
          : `${s.dayCaption} Tap a day to see its value.`}
      </p>
      <ul className="legend">
        {s.legend.map((b) => (
          <li key={b.label}><span className="swatch" style={{ background: `var(--cell-${b.key})` }} />{b.label}</li>
        ))}
      </ul>
    </section>
  );
}
