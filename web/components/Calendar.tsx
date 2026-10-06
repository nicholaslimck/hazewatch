import { useState } from 'react';
import type { Region } from '../../shared/types.ts';
import type { ScaleSpec } from '../../shared/scale.ts';
import { useHistory } from '../api.ts';
import { fmtDay, todaySgt } from '../format.ts';
import { buildCells, monthLabels } from '../calendar.ts';

export function Calendar({ region, tick, spec }: { region: Region; tick: number; spec: ScaleSpec }) {
  const points = useHistory('90d', spec.history.metric, region, tick);
  const [picked, setPicked] = useState<{ date: string; value: number } | null>(null);
  if (!points || points.length === 0) return null;

  const byDate = new Map(points.map((p) => [p.ts, spec.history.convert(p.value)]));
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
          const label = `${fmtDay(c.date)}: ${spec.name} ${v}, ${spec.band(v).label.toLowerCase()}`;
          return (
            <button
              key={c.date}
              type="button"
              className={`cell${cls}`}
              style={{ background: `var(--cell-${spec.band(v).key})` }}
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
        {picked ? `${fmtDay(picked.date)}: ${spec.name} ${picked.value}, ${spec.band(picked.value).label.toLowerCase()}` : `${spec.dayCaption} Tap a day to see its value.`}
      </p>
      <ul className="legend">
        {spec.legend.map((b) => (
          <li key={b.label}><span className="swatch" style={{ background: `var(--cell-${b.key})` }} />{b.label}</li>
        ))}
      </ul>
    </section>
  );
}
