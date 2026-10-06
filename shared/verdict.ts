export type Pollutant = 'pm25' | 'pm10' | 'o3' | 'co' | 'so2';
export const POLLUTANTS: readonly Pollutant[] = ['pm25', 'pm10', 'o3', 'co', 'so2'];

export function verdict(psi: number): [string, string] {
  if (psi <= 50) return ['Clear skies.', 'A good day to be outside.'];
  if (psi <= 100) return ['A little hazy.', 'Fine for a run.'];
  if (psi <= 150) return ['Hazy.', 'Skip the long run today.'];
  if (psi <= 200) return ['Hazy.', 'Keep outdoor exercise light.'];
  if (psi <= 300) return ['Very hazy.', 'Avoid exercising outdoors.'];
  return ['Hazardous.', 'Stay indoors as much as you can.'];
}

// Thirds of the PSI band; hazardous has no upper bound, so it's treated as 301–400 and clamped.
export function bandPosition(psi: number): 'low end' | 'middle' | 'high end' {
  const [lo, hi] = psi <= 50 ? [0, 50] : psi <= 100 ? [51, 100] : psi <= 200 ? [101, 200] : psi <= 300 ? [201, 300] : [301, 400];
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
