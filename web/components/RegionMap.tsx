import { REGIONS } from '../../shared/types.ts';
import type { Region } from '../../shared/types.ts';
import type { ScaleSpec } from '../../shared/scale.ts';
import type { NowResponse } from '../api.ts';
import { regionName } from '../format.ts';
import { MAP } from '../map.ts';

export function RegionMap({ now, selected, onPick, spec }: { now: NowResponse; selected: Region; onPick: (r: Region) => void; spec: ScaleSpec }) {
  const order = [...REGIONS.filter((r) => r !== selected), selected]; // selected last so its stroke sits on top
  return (
    <>
      <svg viewBox={MAP.viewBox} className="map">
        {order.map((r) => {
          const m = now.regions[r];
          const raw = m === undefined ? undefined : spec.value(m);
          const v = raw === undefined ? undefined : Math.round(raw);
          const band = v === undefined ? undefined : spec.band(v);
          const sel = r === selected;
          return (
            <path
              key={r}
              d={MAP.zones[r]}
              fill={band ? `var(--bar-${band.key})` : 'var(--line)'}
              stroke={sel ? 'var(--ink)' : 'var(--bg)'}
              strokeWidth={sel ? 2.5 : 2}
              role="button"
              tabIndex={0}
              aria-label={v === undefined || !band ? `${regionName(r)}, no reading` : `${regionName(r)}, ${spec.name} ${v}, ${band.label.toLowerCase()}`}
              aria-pressed={sel}
              onClick={() => onPick(r)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onPick(r);
                }
              }}
            />
          );
        })}
        {REGIONS.map((r) => {
          const m = now.regions[r];
          const raw = m === undefined ? undefined : spec.value(m);
          const [x, y] = MAP.labels[r];
          return (
            <text key={r} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={13} className="map-label">
              {raw === undefined ? '–' : Math.round(raw)}
            </text>
          );
        })}
      </svg>
      <p className="caption">Zones show the nearest NEA station. They aren't official boundaries.</p>
    </>
  );
}
