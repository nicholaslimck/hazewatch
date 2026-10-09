export type PsiBand = {
  key: 'good' | 'moderate' | 'unhealthy' | 'very_unhealthy' | 'severe' | 'hazardous';
  label: string; advice: string; sensitiveNote: boolean;
  // Sky tokens: color/onColor are light-theme bg/ink, dark* the dark-theme pair; bar/darkBar are the deeper bar shades.
  color: string; onColor: string; darkColor: string; darkOnColor: string; bar: string; darkBar: string;
};

const NORMAL = 'Normal activities';
// Colour ramp. Good/Moderate stay as they were; the three warning bands deepen and gain
// saturation as the air worsens, so the sky itself closes in rather than only the words changing.
// The bands sit far enough apart in luminance to read as steps (light theme L* 0.72 -> 0.55 -> 0.28 -> 0.08).
const GOOD: PsiBand = { key: 'good', label: 'Good', advice: NORMAL, sensitiveNote: false,
  color: '#BFD9EE', onColor: '#1F3346', darkColor: '#1E3446', darkOnColor: '#D6E6F3', bar: '#5785AB', darkBar: '#4F7FA6' };
const MODERATE: PsiBand = { key: 'moderate', label: 'Moderate', advice: NORMAL, sensitiveNote: false,
  color: '#D6DFD8', onColor: '#2E3A33', darkColor: '#2C3631', darkOnColor: '#DCE5DE', bar: '#768579', darkBar: '#6E8273' };
const UNHEALTHY: PsiBand = { key: 'unhealthy', label: 'Unhealthy', advice: 'Reduce prolonged or strenuous outdoor physical exertion', sensitiveNote: true,
  color: '#D6C193', onColor: '#3A2C10', darkColor: '#4A3A12', darkOnColor: '#EDDFB6', bar: '#9B7D28', darkBar: '#B39550' };
const VERY_UNHEALTHY: PsiBand = { key: 'very_unhealthy', label: 'Very unhealthy', advice: 'Avoid prolonged or strenuous outdoor physical exertion', sensitiveNote: true,
  color: '#B98552', onColor: '#2A180A', darkColor: '#3A2610', darkOnColor: '#F3D9B4', bar: '#AB7641', darkBar: '#B07A45' };
const HAZARDOUS: PsiBand = { key: 'hazardous', label: 'Hazardous', advice: 'Minimise outdoor activity', sensitiveNote: true,
  color: '#6E4936', onColor: '#FFF4EA', darkColor: '#271812', darkOnColor: '#F6E1D6', bar: '#7A5240', darkBar: '#A0705A' };

// The bar/darkBar marks layer (region bars, map zones, calendar cells) is deepened so every fill clears
// 3:1 against the fog-line track it sits on (#DDE3E6 light / #2A3136 dark) — the pale calm-band fills were
// near-invisible at 1.6–1.8:1, which broke the at-a-glance comparison the bars exist for. Same hue, lower
// lightness (OKLCH L 0.60); hazardous and severe already cleared it and are unchanged.
export const BANDS: readonly PsiBand[] = [GOOD, MODERATE, UNHEALTHY, VERY_UNHEALTHY, HAZARDOUS];

// Sixth palette, between Very unhealthy and Hazardous. Only AQI uses it (its "Very unhealthy" band); PSI has no band here.
export const SEVERE: PsiBand = { key: 'severe', label: 'Very unhealthy', advice: '', sensitiveNote: true,
  color: '#8A5C40', onColor: '#FFF3E8', darkColor: '#332014', darkOnColor: '#F6DCC8', bar: '#9A5F3C', darkBar: '#B8683F' };

// Every palette that needs CSS tokens (--bar-*, --cell-*).
export const PALETTES: readonly PsiBand[] = [...BANDS, SEVERE];

// Appended to a band's advice when sensitiveNote is set. Lives with the band data so the sky can
// quote it beside the reading (it used to sit in App.tsx and render only in the footer).
export const SENSITIVE_NOTE = 'Elderly, children, pregnant women and people with heart or lung conditions should take extra care.';

// Band edges: the top of each band but the last (which is open-ended). Every threshold in the app derives from these.
export const PSI_EDGES = [50, 100, 200, 300];
export const PM25_1H_EDGES = [55, 150, 250]; // NEA's 1-hour PM2.5 bands: Normal, Elevated, High, Very high
export const PM25_1H_NAMES = ['Normal', 'Elevated', 'High', 'Very high']; // NEA's names for those bands, lowest first
// NEA's hourly PM2.5 edges mark where a band STARTS (55 is the bottom of Elevated), unlike PSI_EDGES,
// which are band tops. So a value's band is the count of edges at or below it — the same start
// semantics `lines()` uses to place the chart's "Elevated 55+" labels, so the two cannot disagree.
export function pm25HourIndex(v: number): number { return PM25_1H_EDGES.filter((e) => v >= e).length; }
export function pm25HourBand(v: number): string { return PM25_1H_NAMES[pm25HourIndex(v)]; }
// The palette the app already fills map zones and calendar cells with, for that same band.
export function pm25HourPalette(v: number): PsiBand { return BANDS[pm25HourIndex(v)]; }
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

// Bands that carry a warning. Good and Moderate never do; every band from "Unhealthy" up does — which is
// what keeps the badge and the hero's colour saying the same thing, on either scale.
// Keyed on the band, not on `alertEdges`: AQI's "Unhealthy for sensitive groups" band (101–150) is
// painted with a warning palette but sits below AQI's first alert edge, so an edge test left the sky
// warning while the badge stayed silent. It also kept a badge on PSI exactly 100, the top of Moderate,
// because that edge is inclusive while the server's alert test (`v > e`) is not.
export function isWarningBand(b: PsiBand): boolean {
  return b.key !== 'good' && b.key !== 'moderate';
}

export function trend(latest: number | undefined, threeHoursAgo: number | undefined): 'rising' | 'falling' | 'steady' | null {
  if (latest === undefined || threeHoursAgo === undefined) return null;
  const d = latest - threeHoursAgo;
  return d >= 10 ? 'rising' : d <= -10 ? 'falling' : 'steady';
}
