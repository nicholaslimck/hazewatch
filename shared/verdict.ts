export type Pollutant = 'pm25' | 'pm10' | 'o3' | 'co' | 'so2';
export const POLLUTANTS: readonly Pollutant[] = ['pm25', 'pm10', 'o3', 'co', 'so2'];

// Band segments on a 0–400 scale, drawn in sky-ink at rising opacity.
export const SCALE: { from: number; to: number; opacity: number }[] = [
  { from: 0, to: 50, opacity: 0.18 },
  { from: 50, to: 100, opacity: 0.3 },
  { from: 100, to: 200, opacity: 0.42 },
  { from: 200, to: 300, opacity: 0.54 },
  { from: 300, to: 400, opacity: 0.66 },
];

export function verdict(psi: number): [string, string] {
  if (psi <= 50) return ['Clear skies.', 'A good day to be outside.'];
  if (psi <= 100) return ['A little hazy.', 'Fine for a run.'];
  if (psi <= 150) return ['Hazy.', 'Skip the long run today.'];
  if (psi <= 200) return ['Hazy.', 'Keep outdoor exercise light.'];
  if (psi <= 300) return ['Very hazy.', 'Avoid exercising outdoors.'];
  return ['Hazardous.', 'Stay indoors as much as you can.'];
}

export const PSI_EDGES = [50, 100, 200, 300, 400]; // upper edge of each band; the last band has no real top, so it's treated as ending at 400

// Thirds of the band `psi` falls in; values past the last edge are clamped into the top band.
export function bandPosition(psi: number, edges: readonly number[] = PSI_EDGES): 'low end' | 'middle' | 'high end' {
  const found = edges.findIndex((e) => psi <= e);
  const i = found < 0 ? edges.length - 1 : found;
  const lo = i === 0 ? 0 : edges[i - 1] + 1;
  const hi = edges[i];
  const d = (Math.min(Math.max(psi, lo), hi) - lo) * 3; // compare in integers: d / (hi - lo) vs 1 and 2
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
