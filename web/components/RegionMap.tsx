import { useState } from 'react';
import { REGIONS } from '../../shared/types.ts';
import type { Region } from '../../shared/types.ts';
import type { ScaleSpec } from '../../shared/scale.ts';
import type { NowResponse } from '../api.ts';
import { regionName } from '../format.ts';
import { MAP } from '../map.ts';

export function RegionMap({ now, selected, onPick, spec }: { now: NowResponse; selected: Region; onPick: (r: Region) => void; spec: ScaleSpec }) {
  const [focused, setFocused] = useState<Region | null>(null);
  const values = new Map<Region, number | undefined>(
    REGIONS.map((r) => {
      const m = now.regions[r];
      const raw = m === undefined ? undefined : spec.value(m);
      return [r, raw === undefined ? undefined : Math.round(raw)];
    }),
  );
  return (
    <>
      <svg viewBox={MAP.viewBox} className="map">
        {/* DOM/tab order stays fixed; selected + focus rings are non-interactive overlays drawn after all zones. */}
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
              role="button"
              tabIndex={0}
              aria-label={v === undefined || !band ? `${regionName(r)}, no reading` : `${regionName(r)}, ${spec.name} ${v}, ${band.label.toLowerCase()}`}
              aria-pressed={r === selected}
              onClick={() => onPick(r)}
              onFocus={() => setFocused(r)}
              onBlur={() => setFocused(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onPick(r);
                }
              }}
            />
          );
        })}
        <path d={MAP.zones[selected]} fill="none" stroke="var(--ink)" strokeWidth={2.5} pointerEvents="none" aria-hidden="true" />
        {focused && (
          <>
            <path d={MAP.zones[focused]} fill="none" stroke="var(--ink)" strokeWidth={5} pointerEvents="none" aria-hidden="true" />
            <path d={MAP.zones[focused]} fill="none" stroke="var(--bg)" strokeWidth={1.5} pointerEvents="none" aria-hidden="true" />
          </>
        )}
        {REGIONS.map((r) => {
          const v = values.get(r);
          const [x, y] = MAP.labels[r];
          return (
            <text key={r} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={13} className="map-label" aria-hidden="true">
              {v === undefined ? '–' : v}
            </text>
          );
        })}
      </svg>
      <p className="caption">Zones show the nearest NEA station. They aren't official boundaries.</p>
    </>
  );
}
