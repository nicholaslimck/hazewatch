import { REGIONS } from '../../shared/types.ts';
import type { Region } from '../../shared/types.ts';
import { psiBand } from '../../shared/bands.ts';
import type { NowResponse } from '../api.ts';
import { regionName } from '../format.ts';

export function Regions({ now, selected }: { now: NowResponse; selected: Region }) {
  const rows = REGIONS.map((r) => ({ r, v: now.regions[r]?.psi_twenty_four_hourly }));
  rows.sort((a, b) => (b.v ?? -1) - (a.v ?? -1)); // worst first, no-reading last
  const scale = Math.max(100, ...rows.map((x) => x.v ?? 0));
  return (
    <section className="card" aria-labelledby="regions-title">
      <h2 id="regions-title">Regions now</h2>
      <ul className="bars">
        {rows.map(({ r, v }) => {
          const band = v === undefined ? null : psiBand(v);
          return (
            <li key={r} className={r === selected ? 'bar-row selected' : 'bar-row'}>
              <span className="bar-name">{regionName(r)}</span>
              {v === undefined || band === null ? (
                <span className="muted">No reading</span>
              ) : (
                <>
                  <span className="bar-track">
                    <span className="bar" style={{ width: `${(v / scale) * 100}%`, background: band.color }} />
                  </span>
                  <span className="bar-value">{Math.round(v)} <span className="muted">{band.label}</span></span>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
