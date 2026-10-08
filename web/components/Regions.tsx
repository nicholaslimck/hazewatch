import { REGIONS } from '../../shared/types.ts';
import type { Region } from '../../shared/types.ts';
import type { ScaleSpec } from '../../shared/scale.ts';
import { SCALE_TOP } from '../../shared/bands.ts';
import type { NowResponse } from '../api.ts';
import { regionName } from '../../shared/format.ts';
import { RegionMap } from './RegionMap.tsx';

export function Regions({ now, selected, onPick, spec }: { now: NowResponse; selected: Region; onPick: (r: Region) => void; spec: ScaleSpec }) {
  const rows = REGIONS.map((r) => {
    const m = now.regions[r];
    return { r, v: m === undefined ? undefined : spec.value(m) };
  });
  rows.sort((a, b) => (b.v ?? -1) - (a.v ?? -1)); // worst first, no-reading last

  // The bars share one domain that starts and ends on a band edge. On a fixed 0–SCALE_TOP track every
  // real reading sat inside the same tenth of the track and the five regions looked alike, which made
  // "on the same scale" true but useless. Narrowing the domain to the bands actually in view is what
  // makes them comparable; the band edges are still drawn as ticks, so absolute position stays legible.
  const edges = spec.segments.map((s) => s.from).filter((v) => v > 0);
  const vals = rows.map((d) => d.v).filter((v): v is number => v !== undefined);
  const lo = vals.length === 0 ? 0 : (edges.filter((e) => e <= Math.min(...vals)).pop() ?? 0);
  let hi = vals.length === 0 ? SCALE_TOP : (edges.find((e) => e >= Math.max(...vals)) ?? SCALE_TOP);
  if (hi <= lo) hi = edges.find((e) => e > lo) ?? SCALE_TOP;
  const at = (v: number) => `${Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100))}%`;
  const ticks = edges.filter((e) => e > lo && e < hi);

  return (
    <section aria-labelledby="regions-title">
      <h2 id="regions-title">Around Singapore</h2>
      <RegionMap now={now} selected={selected} onPick={onPick} spec={spec} />
      <ul className="rows">
        {rows.map(({ r, v }) => (
          <li key={r}>
            <button
              type="button"
              className={r === selected ? 'row selected' : 'row'}
              aria-pressed={r === selected}
              onClick={() => onPick(r)}
            >
              <span>{regionName(r)}</span>
              {v === undefined ? (
                <span className="muted no-reading">No reading</span>
              ) : (
                <>
                  <span className="track">
                    <span
                      className="fill"
                      style={{ width: at(v), background: `var(--bar-${spec.band(Math.round(v)).key})` }}
                    />
                    {ticks.map((t) => <span key={t} className="tick" style={{ left: at(t) }} />)}
                  </span>
                  <span className="psi">{Math.round(v)}</span>
                </>
              )}
            </button>
          </li>
        ))}
      </ul>
      <p className="caption">{spec.name} for each region. The bars share one scale, {lo}–{hi}. Tap one to switch.</p>
    </section>
  );
}
