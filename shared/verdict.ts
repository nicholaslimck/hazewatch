import { bandIndex, PSI_EDGES, SCALE_TOP, segments } from './bands.ts';

export type Pollutant = 'pm25' | 'pm10' | 'o3' | 'co' | 'so2';
export const POLLUTANTS: readonly Pollutant[] = ['pm25', 'pm10', 'o3', 'co', 'so2'];

// PSI band segments, drawn in sky-ink at rising opacity.
// The faintest step was 0.18 (about 1.3:1 on the sky); band edges are now carried by the tick numbers
// under the bar, and the shading starts at 0.35 so the lowest bands still read as part of the bar.
export const SCALE = segments(PSI_EDGES, [0.35, 0.45, 0.55, 0.65, 0.75]);

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

// NEA's PM2.5 sub-index breakpoints (µg/m³ -> PSI), read off NEA's own published pairs: they reproduce
// 99.6% of the app's stored PM2.5 sub-indices to within 1 point.
const PM25_PSI = [
  { cLo: 0, cHi: 12.4, iLo: 0, iHi: 50 },
  { cLo: 12.5, cHi: 55.4, iLo: 51, iHi: 100 },
  { cLo: 55.5, cHi: 150.4, iLo: 101, iHi: 200 },
  { cLo: 150.5, cHi: 250.4, iLo: 201, iHi: 300 },
  { cLo: 250.5, cHi: 350.4, iLo: 301, iHi: 400 },
  { cLo: 350.5, cHi: 500.4, iLo: 401, iHi: 500 },
];
export function pm25PsiSubIndex(c: number): number {
  const t = Math.round(Math.max(c, 0) * 10) / 10;
  const b = PM25_PSI.find((x) => t <= x.cHi) ?? PM25_PSI[PM25_PSI.length - 1];
  return Math.round(((b.iHi - b.iLo) / (b.cHi - b.cLo)) * (t - b.cLo) + b.iLo);
}

// An estimate of where PSI is heading: NEA's method with the PM2.5 sub-index taken from the NowCast
// (last 12 hours, weighted to the recent ones) instead of the 24-hour mean, and NEA's other sub-indices
// as published. Not NEA's reading; on Jul–Oct 2026 data it reached Unhealthy a median ~6 hours before
// NEA's PSI, but crossed in and out about three times as often, so it is shown as a line, never as the sky.
export function psiNowcast(m: Record<string, number>): number | undefined {
  if (m.pm25_nowcast === undefined) return undefined;
  const others = ['pm10_sub_index', 'so2_sub_index', 'o3_sub_index', 'co_sub_index'].map((k) => m[k] ?? 0);
  return Math.max(pm25PsiSubIndex(m.pm25_nowcast), ...others);
}
