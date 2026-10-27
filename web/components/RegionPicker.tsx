import { useState } from 'react';
import { REGIONS } from '../../shared/types.ts';
import type { Region } from '../../shared/types.ts';
import type { ScaleSpec } from '../../shared/scale.ts';
import type { NowResponse } from '../api.ts';
import { regionName } from '../../shared/format.ts';
import { RegionMap } from './RegionMap.tsx';

// First run without location: the map is the picker, because people know where they live, not which NEA
// region that is. The map is pointer-only, so five off-screen buttons carry keyboard and screen-reader
// choice; the focused one rings its zone on the map, which is the visible focus indicator.
export function RegionPicker({ onPick, now, spec }: { onPick: (r: Region) => void; now: NowResponse; spec: ScaleSpec }) {
  const [focused, setFocused] = useState<Region | null>(null);
  return (
    <section className="picker" aria-labelledby="picker-title">
      <h2 id="picker-title">Choose your region</h2>
      <p className="muted">Location isn't available. Tap the area closest to you.</p>
      <RegionMap now={now} selected={null} onPick={onPick} spec={spec} named focused={focused} />
      {REGIONS.map((r) => {
        const m = now.regions[r];
        const v = m === undefined ? undefined : spec.value(m);
        return (
          <button
            key={r} type="button" className="sr-only"
            onFocus={() => setFocused(r)} onBlur={() => setFocused(null)} onClick={() => onPick(r)}
          >
            {v === undefined ? `${regionName(r)}, no reading` : `${regionName(r)}, ${spec.name} ${Math.round(v)}, ${spec.band(Math.round(v)).label.toLowerCase()}`}
          </button>
        );
      })}
    </section>
  );
}
