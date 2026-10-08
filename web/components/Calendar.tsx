import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { Region } from '../../shared/types.ts';
import type { ScaleSpec } from '../../shared/scale.ts';
import { useHistory } from '../api.ts';
import type { HistoryPoint } from '../api.ts';
import { fmtDay, todaySgt } from '../../shared/format.ts';
import { buildCells, defaultFocusIndex, isFocusable, monthLabels, stepFocus } from '../calendar.ts';

// Arrow keys move one day (up/down) or one week to the same weekday (left/right) across the grid.
const STEP: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 };

export function Calendar({ region, tick, spec }: { region: Region; tick: number; spec: ScaleSpec }) {
  const fresh = useHistory('90d', spec.history.metric, region, tick);
  // While a new region or scale loads, keep drawing the last grid (dimmed) with the spec it was drawn with,
  // so the page doesn't collapse and jump.
  const last = useRef<{ points: HistoryPoint[]; spec: ScaleSpec } | null>(null);
  if (fresh && fresh.length > 0) last.current = { points: fresh, spec };
  const loading = fresh === null && last.current !== null;
  const shown = fresh && fresh.length > 0 ? { points: fresh, spec } : loading ? last.current : null;

  const [picked, setPicked] = useState<string | null>(null);
  // The one cell that carries the grid's tab stop; every other day is tabIndex -1, reached with the arrows.
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  useEffect(() => { setPicked(null); setFocusIdx(null); }, [region, spec]);
  if (shown === null) return null;

  const s = shown.spec;
  const byDate = new Map(shown.points.map((p) => [p.ts, s.history.convert(p.value)]));
  const cells = buildCells(shown.points[shown.points.length - 1].ts, byDate);
  const today = todaySgt();
  const activeIdx = focusIdx !== null && focusIdx < cells.length && isFocusable(cells[focusIdx])
    ? focusIdx
    : defaultFocusIndex(cells, today);
  const pickedValue = picked === null ? undefined : byDate.get(picked);
  const describe = (date: string, v: number) => `${fmtDay(date)}: ${s.name} ${v}, ${s.band(v).label.toLowerCase()}`;

  // Roving tabindex: Home/End jump to the ends, arrows walk day by day and week by week, and focus
  // follows the cell so the browser keeps the ring on it.
  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (activeIdx < 0) return;
    const next = e.key === 'Home' ? stepFocus(cells, -1, 1)
      : e.key === 'End' ? stepFocus(cells, cells.length, -1)
      : e.key in STEP ? stepFocus(cells, activeIdx, STEP[e.key])
      : -1;
    if (next < 0) return;
    e.preventDefault();
    setFocusIdx(next);
    grid.current?.querySelector<HTMLButtonElement>(`[data-date="${cells[next].date}"]`)?.focus();
  }

  return (
    <section aria-labelledby="cal-title" aria-busy={loading} className={loading ? 'loading' : undefined}>
      <h2 id="cal-title">Last 90 days</h2>
      <div
        className="cal"
        role="group"
        aria-label="One reading per day. Use the arrow keys to move between days."
        ref={grid}
        onKeyDown={onKeyDown}
      >
        {cells.map((c, i) => {
          const cls = c.date === today ? ' today' : '';
          if (!c.inRange) return <span key={c.date} className="cell out" />;
          if (c.value === undefined) return <span key={c.date} className={`cell empty${cls}`} title={`${fmtDay(c.date)}: no data`} />;
          const v = Math.round(c.value);
          const isPicked = c.date === picked;
          return (
            <button
              key={c.date}
              type="button"
              data-date={c.date}
              tabIndex={i === activeIdx ? 0 : -1}
              className={`cell${cls}${isPicked ? ' picked' : ''}`}
              style={{ background: `var(--cell-${s.band(v).key})` }}
              title={describe(c.date, v)}
              aria-label={describe(c.date, v)}
              aria-pressed={isPicked}
              onClick={() => setPicked(isPicked ? null : c.date)}
              onFocus={() => setFocusIdx(i)}
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
