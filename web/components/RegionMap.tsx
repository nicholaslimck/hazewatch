import { REGIONS } from '../../shared/types.ts';
import type { Region } from '../../shared/types.ts';
import type { ScaleSpec } from '../../shared/scale.ts';
import type { NowResponse } from '../api.ts';
import { MAP } from '../map.ts';
import { regionName } from '../../shared/format.ts';

// `named`: zones carry their region name above the number (the first-run picker, where names aren't known yet).
// `focused`: a zone to ring as the keyboard focus indicator, when an off-screen control stands in for it.
export function RegionMap({ now, selected, onPick, spec, named = false, focused = null }: { now: NowResponse; selected: Region | null; onPick: (r: Region) => void; spec: ScaleSpec; named?: boolean; focused?: Region | null }) {
  const values = new Map<Region, number | undefined>(
    REGIONS.map((r) => {
      const m = now.regions[r];
      const raw = m === undefined ? undefined : spec.value(m);
      return [r, raw === undefined ? undefined : Math.round(raw)];
    }),
  );
  return (
    <>
      {/* Pointer-only: the region rows below are the keyboard and screen-reader way to switch, with the same
          values in ranked order, so the map stays out of the tab order instead of repeating five stops in a
          different order. */}
      <svg viewBox={MAP.viewBox} className="map" aria-hidden="true">
        {REGIONS.map((r) => {
          const v = values.get(r);
          const band = v === undefined ? undefined : spec.band(v);
          return (
            <path
              key={r}
              d={MAP.zones[r]}
              fill={band ? `var(--bar-${band.key})` : 'var(--line)'}
              stroke="var(--bg)"
              strokeWidth={2}
              className="zone"
              onClick={() => onPick(r)}
            />
          );
        })}
        {selected && <path d={MAP.zones[selected]} fill="none" stroke="var(--ink)" strokeWidth={2.5} pointerEvents="none" />}
        {focused && (
          <>
            <path d={MAP.zones[focused]} fill="none" stroke="var(--ink)" strokeWidth={5} pointerEvents="none" />
            <path d={MAP.zones[focused]} fill="none" stroke="var(--bg)" strokeWidth={1.5} pointerEvents="none" />
          </>
        )}
        {REGIONS.map((r) => {
          const v = values.get(r);
          const [x, y] = MAP.labels[r];
          const band = v === undefined ? undefined : spec.band(v);
          // Large (3:1 is the bar) and in whichever ink reads on the zone's fill, so no halo is needed.
          return (
            <text key={r} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={20} className="map-label"
              style={{ fill: band ? `var(--bar-label-${band.key})` : 'var(--ink)' }}>
              {named ? <><tspan x={x} dy="-0.6em">{regionName(r)}</tspan><tspan x={x} dy="1.2em">{v === undefined ? '–' : v}</tspan></> : v === undefined ? '–' : v}
            </text>
          );
        })}
      </svg>
      <p className="caption">Zones show the nearest NEA station. They aren't official boundaries.</p>
    </>
  );
}
