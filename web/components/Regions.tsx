import { REGIONS } from '../../shared/types.ts';
import type { Region } from '../../shared/types.ts';
import { psiBand } from '../../shared/bands.ts';
import type { NowResponse } from '../api.ts';
import { regionName } from '../format.ts';

export function Regions({ now, selected, onPick }: { now: NowResponse; selected: Region; onPick: (r: Region) => void }) {
  const rows = REGIONS.map((r) => ({ r, v: now.regions[r]?.psi_twenty_four_hourly }));
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
                      style={{ width: `${(Math.min(v, 400) / 400) * 100}%`, background: `var(--bar-${psiBand(v).key})` }}
                    />
                  </span>
                  <span className="psi">{Math.round(v)}</span>
                </>
              )}
            </button>
          </li>
        ))}
      </ul>
      <p className="caption">Same scale for every region. Tap one to switch.</p>
    </section>
  );
}
