import { REGIONS } from '../../shared/types.ts';
import type { Region } from '../../shared/types.ts';
import type { ScaleSpec } from '../../shared/scale.ts';
import type { HistoryPoint, NowResponse } from '../api.ts';
import { fmtWhen, regionName } from '../../shared/format.ts';
import { RegionMap } from './RegionMap.tsx';
import { sharedRange } from '../series.ts';

// `asOf` is set when the reading can't be vouched for as current, so the caption dates it.
// The map answers "where is it worse now"; each row answers "which way has this region moved, and by how
// much": a hollow dot for the start of the last 24 hours, a solid dot for now, on one scale for all five.
// It replaced a 24-hour line per row, which drew PSI (a 24-hour average) as five near-flat strokes.
export function Regions({ now, selected, onPick, spec, asOf = null, history }: { now: NowResponse; selected: Region; onPick: (r: Region) => void; spec: ScaleSpec; asOf?: string | null; history: HistoryPoint[] | null }) {
  // The oldest point in the 24-hour window, per region (history arrives oldest first).
  const then = new Map<Region, HistoryPoint>();
  for (const p of history ?? []) if (!then.has(p.region)) then.set(p.region, { ...p, value: spec.history.convert(p.value) });
  const rows = REGIONS.map((r) => {
    const m = now.regions[r];
    const v = m === undefined ? undefined : spec.value(m);
    // shortcut: on AQI the start is that hour's AQI while now is the NowCast the hero shows, so the delta
    // mixes the two; fine for direction and size, revisit if the server stores a NowCast series.
    return { r, v: v === undefined ? undefined : Math.round(v), start: then.get(r) };
  });
  rows.sort((a, b) => (b.v ?? -1) - (a.v ?? -1)); // worst first, no-reading last

  const [lo, hi] = sharedRange(rows.flatMap((d) => [...(d.v === undefined ? [] : [d.v]), ...(d.start ? [Math.round(d.start.value)] : [])]));
  const pct = (v: number) => ((Math.min(Math.max(v, lo), hi) - lo) / (hi - lo)) * 100;
  const startTs = rows.find((d) => d.start)?.start?.ts;
  const since = startTs ? fmtWhen(startTs) : null; // "Mon 12:00 pm", or just the time when it is today
  const delta = (d: number) => (d > 0 ? `+${d}` : d < 0 ? `−${-d}` : '0');
  const said = (d: number) => (d > 0 ? `up ${d}` : d < 0 ? `down ${-d}` : 'no change');

  return (
    <section aria-labelledby="regions-title">
      <h2 id="regions-title">Around Singapore</h2>
      <RegionMap now={now} selected={selected} onPick={onPick} spec={spec} />
      <ul className="rows">
        {rows.map(({ r, v, start }) => {
          const d = v === undefined || !start ? null : v - Math.round(start.value);
          return (
            <li key={r}>
              <button
                type="button"
                className={r === selected ? 'row selected' : 'row'}
                aria-pressed={r === selected}
                // Spelled out: the visible parts run together ("Central170") and don't name the scale.
                aria-label={v === undefined ? `${regionName(r)}, no reading` : `${regionName(r)}, ${spec.name} ${v}${d === null ? '' : `, ${said(d)} since ${since}`}`}
                onClick={() => onPick(r)}
              >
                <span>{regionName(r)}</span>
                {v === undefined ? (
                  <span className="muted no-reading">No reading</span>
                ) : (
                  <>
                    <span className="tn" aria-hidden="true">
                      {start && (
                        <>
                          <span className="tn-span" style={{ left: `${Math.min(pct(start.value), pct(v))}%`, width: `${Math.abs(pct(v) - pct(start.value))}%` }} />
                          <span className="tn-then" style={{ left: `${pct(start.value)}%` }} />
                        </>
                      )}
                      <span className="tn-now" style={{ left: `${pct(v)}%` }} />
                    </span>
                    <span className="psi">
                      {/* The band shade lives on the number's mark, so the band is still read at a glance. */}
                      <span className="spark-dot" style={{ background: `var(--bar-${spec.band(v).key})` }} aria-hidden="true" />
                      {v}
                      {d !== null && <span className="tn-delta">{delta(d)}</span>}
                    </span>
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="tn-axis" aria-hidden="true">
        <div><span>{lo}</span><span>{(lo + hi) / 2}</span><span>{hi}</span></div>
      </div>
      {since && (
        <p className="tn-key" aria-hidden="true">
          <span><span className="tn-then" />{since}</span>
          <span><span className="tn-now" />{asOf ? fmtWhen(asOf) : 'now'}</span>
        </p>
      )}
      <p className="caption">
        {asOf && `As of ${fmtWhen(asOf)}. `}
        {spec.name} now against 24 hours earlier, on one scale for all five. Tap a region to switch.
      </p>
    </section>
  );
}
