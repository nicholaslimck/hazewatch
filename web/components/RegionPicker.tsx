import { REGIONS } from '../../shared/types.ts';
import type { Region } from '../../shared/types.ts';
import { regionName } from '../format.ts';

export function RegionPicker({ onPick }: { onPick: (r: Region) => void }) {
  return (
    <section className="card" aria-labelledby="picker-title">
      <h2 id="picker-title">Choose your region</h2>
      <p className="muted">Location isn't available. Pick the region closest to you.</p>
      <div className="picker">
        {REGIONS.map((r) => (
          <button key={r} type="button" onClick={() => onPick(r)}>{regionName(r)}</button>
        ))}
      </div>
    </section>
  );
}
