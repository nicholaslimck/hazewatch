import { bandIndex, PSI_EDGES, SCALE_TOP, segments } from './bands.ts';

export type Pollutant = 'pm25' | 'pm10' | 'o3' | 'co' | 'so2';
export const POLLUTANTS: readonly Pollutant[] = ['pm25', 'pm10', 'o3', 'co', 'so2'];

// PSI band segments, drawn in sky-ink at rising opacity.
export const SCALE = segments(PSI_EDGES, [0.18, 0.3, 0.42, 0.54, 0.66]);

// PSI's band edges plus a split at 150, where the run advice changes inside Unhealthy.
const PSI_VERDICT_EDGES = [...PSI_EDGES, 150].sort((a, b) => a - b);
const PSI_VERDICTS: [string, string][] = [
  ['Clear skies.', 'A good day to be outside.'],
  ['A little hazy.', 'Fine for a run.'],
  ['Hazy.', 'Skip the long run today.'],
  ['Hazy.', 'Keep outdoor exercise light.'],
  ['Very hazy.', 'Avoid exercising outdoors.'],
  ['Hazardous.', 'Stay indoors as much as you can.'],
];

export function verdict(psi: number): [string, string] {
  return PSI_VERDICTS[bandIndex(psi, PSI_VERDICT_EDGES)];
}

// Thirds of the band `v` falls in; the open last band is treated as ending at SCALE_TOP and values past it clamp.
export function bandPosition(v: number, edges: readonly number[] = PSI_EDGES): 'low end' | 'middle' | 'high end' {
  const i = bandIndex(v, edges);
  const lo = i === 0 ? 0 : edges[i - 1] + 1;
  const hi = i < edges.length ? edges[i] : SCALE_TOP;
  const d = (Math.min(Math.max(v, lo), hi) - lo) * 3; // compare in integers: d / (hi - lo) vs 1 and 2
  return d < hi - lo ? 'low end' : d < 2 * (hi - lo) ? 'middle' : 'high end';
}

// Highest `{p}_sub_index`; ties go to the first in POLLUTANTS order.
export function dominantPollutant(metrics: Record<string, number>): Pollutant | null {
  let best: Pollutant | null = null;
  for (const p of POLLUTANTS) {
    const v = metrics[`${p}_sub_index`];
    if (v !== undefined && (best === null || v > metrics[`${best}_sub_index`])) best = p;
  }
  return best;
}
