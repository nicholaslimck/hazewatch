import { REGIONS } from '../../shared/types.ts';
import type { Region } from '../../shared/types.ts';
import type { ScaleSpec } from '../../shared/scale.ts';
import { scaleFraction } from '../../shared/bands.ts';
import type { NowResponse } from '../api.ts';
import { regionName } from '../format.ts';

export function Regions({ now, selected, onPick, spec }: { now: NowResponse; selected: Region; onPick: (r: Region) => void; spec: ScaleSpec }) {
  const rows = REGIONS.map((r) => {
    const m = now.regions[r];
    return { r, v: m === undefined ? undefined : spec.value(m) };
  });
  rows.sort((a, b) => (b.v ?? -1) - (a.v ?? -1)); // worst first, no-reading last
  return (
    <section aria-labelledby="regions-title">
      <h2 id="regions-title">Around Singapore</h2>
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
                      style={{ width: `${scaleFraction(v) * 100}%`, background: `var(--bar-${spec.band(Math.round(v)).key})` }}
                    />
                  </span>
                  <span className="psi">{Math.round(v)}</span>
                </>
              )}
            </button>
          </li>
        ))}
      </ul>
      <p className="caption">{spec.name} for each region, on the same scale. Tap one to switch.</p>
    </section>
  );
}
