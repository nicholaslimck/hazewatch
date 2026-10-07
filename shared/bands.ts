export type PsiBand = {
  key: 'good' | 'moderate' | 'unhealthy' | 'very_unhealthy' | 'severe' | 'hazardous';
  label: string; advice: string; sensitiveNote: boolean;
  // Sky tokens: color/onColor are light-theme bg/ink, dark* the dark-theme pair; bar/darkBar are the deeper bar shades.
  color: string; onColor: string; darkColor: string; darkOnColor: string; bar: string; darkBar: string;
};

const NORMAL = 'Normal activities';
const GOOD: PsiBand = { key: 'good', label: 'Good', advice: NORMAL, sensitiveNote: false,
  color: '#BFD9EE', onColor: '#1F3346', darkColor: '#1E3446', darkOnColor: '#D6E6F3', bar: '#7FAFD6', darkBar: '#4F7FA6' };
const MODERATE: PsiBand = { key: 'moderate', label: 'Moderate', advice: NORMAL, sensitiveNote: false,
  color: '#D6DFD8', onColor: '#2E3A33', darkColor: '#2C3631', darkOnColor: '#DCE5DE', bar: '#A9B9AD', darkBar: '#6E8273' };
const UNHEALTHY: PsiBand = { key: 'unhealthy', label: 'Unhealthy', advice: 'Reduce prolonged or strenuous outdoor physical exertion', sensitiveNote: true,
  color: '#D9C9A0', onColor: '#3D2F12', darkColor: '#4A3F22', darkOnColor: '#EBDDB8', bar: '#C8A957', darkBar: '#B39550' };
const VERY_UNHEALTHY: PsiBand = { key: 'very_unhealthy', label: 'Very unhealthy', advice: 'Avoid prolonged or strenuous outdoor physical exertion', sensitiveNote: true,
  color: '#C49A6C', onColor: '#3A2410', darkColor: '#4E3622', darkOnColor: '#EFD3B5', bar: '#B07A45', darkBar: '#B07A45' };
const HAZARDOUS: PsiBand = { key: 'hazardous', label: 'Hazardous', advice: 'Minimise outdoor activity', sensitiveNote: true,
  color: '#86644F', onColor: '#FFF4EA', darkColor: '#3E2A22', darkOnColor: '#F3DCCF', bar: '#7A5240', darkBar: '#A0705A' };

export const BANDS: readonly PsiBand[] = [GOOD, MODERATE, UNHEALTHY, VERY_UNHEALTHY, HAZARDOUS];

// Sixth palette, between Very unhealthy and Hazardous. Only AQI uses it (its "Very unhealthy" band); PSI has no band here.
export const SEVERE: PsiBand = { key: 'severe', label: 'Very unhealthy', advice: '', sensitiveNote: true,
  color: '#A57F5D', onColor: '#2A180A', darkColor: '#5A3326', darkOnColor: '#F2D6C4', bar: '#9A5F3C', darkBar: '#B8683F' };

// Every palette that needs CSS tokens (--bar-*, --cell-*).
export const PALETTES: readonly PsiBand[] = [...BANDS, SEVERE];

// Appended to a band's advice when sensitiveNote is set. Lives with the band data so the sky can
// quote it beside the reading (it used to sit in App.tsx and render only in the footer).
export const SENSITIVE_NOTE = 'Elderly, children, pregnant women and people with heart or lung conditions should take extra care.';

// Band edges: the top of each band but the last (which is open-ended). Every threshold in the app derives from these.
export const PSI_EDGES = [50, 100, 200, 300];
export const PM25_1H_EDGES = [55, 150, 250]; // NEA's 1-hour PM2.5 bands: Normal, Elevated, High, Very high
export const SCALE_TOP = 400; // where drawn scales stop; the open last band is treated as ending here
export const scaleFraction = (v: number) => Math.min(Math.max(v, 0), SCALE_TOP) / SCALE_TOP; // 0–1 position on a drawn scale

// Index of the band `v` falls in: 0 for <= edges[0], edges.length for anything above the last edge.
export function bandIndex(v: number, edges: readonly number[]): number {
  const i = edges.findIndex((e) => v <= e);
  return i < 0 ? edges.length : i;
}

// Drawn segments from 0 to SCALE_TOP, one per band, with one opacity per band.
export function segments(edges: readonly number[], opacities: readonly number[]): { from: number; to: number; opacity: number }[] {
  const tops = [...edges, SCALE_TOP];
  return tops.map((to, i) => ({ from: i === 0 ? 0 : tops[i - 1], to, opacity: opacities[i] }));
}

export function psiBand(v: number): PsiBand {
  return BANDS[bandIndex(v, PSI_EDGES)];
}

export function trend(latest: number | undefined, threeHoursAgo: number | undefined): 'rising' | 'falling' | 'steady' | null {
  if (latest === undefined || threeHoursAgo === undefined) return null;
  const d = latest - threeHoursAgo;
  return d >= 10 ? 'rising' : d <= -10 ? 'falling' : 'steady';
}
