export type PsiBand = {
  key: 'good' | 'moderate' | 'unhealthy' | 'very_unhealthy' | 'severe' | 'hazardous';
  // `advice` is for everyone; `sensitive` is the instruction for sensitive groups ('' when there is none).
  label: string; advice: string; sensitive: string;
  // Sky tokens: color/onColor are light-theme bg/ink, dark* the dark-theme pair; bar/darkBar are the deeper bar shades.
  color: string; onColor: string; darkColor: string; darkOnColor: string; bar: string; darkBar: string;
};

const NORMAL = 'Go about your day as normal.';
// Who NEA's advisory singles out, named once so every band's instruction addresses the same people.
export const SENSITIVE_GROUPS = 'Older people, children, pregnant women and anyone with a heart or lung condition';
// The instruction alone ("stay indoors as much as you can."), for sentences that name the reader another way.
export const sensitiveAction = (b: { sensitive: string }) =>
  b.sensitive.startsWith(`${SENSITIVE_GROUPS}: `) ? b.sensitive.slice(SENSITIVE_GROUPS.length + 2) : b.sensitive;
// Colour ramp. The three warning bands deepen and gain saturation as the air worsens, so the sky
// itself closes in rather than only the words changing.
// The bands sit far enough apart in luminance to read as steps (light theme L* 0.72 -> 0.55 -> 0.28 -> 0.08).
const GOOD: PsiBand = { key: 'good', label: 'Good', advice: NORMAL, sensitive: '',
  color: '#BFD9EE', onColor: '#1F3346', darkColor: '#1E3446', darkOnColor: '#D6E6F3', bar: '#5381A7', darkBar: '#5182A9' };
const MODERATE: PsiBand = { key: 'moderate', label: 'Moderate', advice: NORMAL, sensitive: '',
  color: '#D6DFD8', onColor: '#2E3A33', darkColor: '#2C3631', darkOnColor: '#DCE5DE', bar: '#5E6C61', darkBar: '#7C9181' };
const UNHEALTHY: PsiBand = { key: 'unhealthy', label: 'Unhealthy', advice: 'Cut back on long or hard exercise outside.', sensitive: `${SENSITIVE_GROUPS}: keep outdoor exercise short and easy.`,
  color: '#D6C193', onColor: '#3A2C10', darkColor: '#4A3A12', darkOnColor: '#EDDFB6', bar: '#6B5303', darkBar: '#B69853' };
const VERY_UNHEALTHY: PsiBand = { key: 'very_unhealthy', label: 'Very unhealthy', advice: 'Avoid long or hard exercise outside.', sensitive: `${SENSITIVE_GROUPS}: stay indoors as much as you can.`,
  color: '#B98552', onColor: '#2A180A', darkColor: '#3A2610', darkOnColor: '#F3D9B4', bar: '#653A03', darkBar: '#D9A16B' };
const HAZARDOUS: PsiBand = { key: 'hazardous', label: 'Hazardous', advice: 'Spend as little time outside as you can.', sensitive: `${SENSITIVE_GROUPS}: stay indoors. Go out only if you must.`,
  color: '#6E4936', onColor: '#FFF4EA', darkColor: '#271812', darkOnColor: '#F6E1D6', bar: '#321102', darkBar: '#FBC6AE' };

// The bar/darkBar marks layer (map zones, region-row squares, calendar cells) is a lightness ramp, so a
// band reads by depth and not by hue alone (the earlier marks all sat at one lightness, 1.01:1 apart).
// Same hues as the skies (OKLCH, chroma eased where the gamut runs out). Light: the calmest band clears
// 3.2:1 against the Fog Line track (#DDE3E6) and each worse band is 1.33:1 darker, down to near-peat.
// Dark: it runs the other way, calm bands dim and worse bands brighter by 1.22:1 a step, from 3.2:1
// against the dark track (#2A3136), so a calm day stays quiet beside the sky and a bad one glows.
export const BANDS: readonly PsiBand[] = [GOOD, MODERATE, UNHEALTHY, VERY_UNHEALTHY, HAZARDOUS];

// Sixth palette, between Very unhealthy and Hazardous. Only AQI uses it (its "Very unhealthy" band); PSI has no band here.
export const SEVERE: PsiBand = { key: 'severe', label: 'Very unhealthy', advice: '', sensitive: '',
  color: '#8A5C40', onColor: '#FFF3E8', darkColor: '#332014', darkOnColor: '#F6DCC8', bar: '#532401', darkBar: '#FDAB83' };

// Map numbers sit on these fills: the darker or lighter of the two page inks, whichever reads better.
const relLum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => { const c = parseInt(hex.slice(i, i + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a: string, b: string) => { const [x, y] = [relLum(a), relLum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
export const labelOn = (fill: string) => (contrast(fill, '#1B2226') >= contrast(fill, '#F4F6F7') ? '#1B2226' : '#F4F6F7');

// Every palette that needs CSS tokens (--bar-*, --cell-*, --bar-label-*).
export const PALETTES: readonly PsiBand[] = [...BANDS, SEVERE];


// Band edges: the top of each band but the last (which is open-ended). Every threshold in the app derives from these.
export const PSI_EDGES = [50, 100, 200, 300];
export const PM25_1H_EDGES = [55, 150, 250]; // NEA's 1-hour PM2.5 bands: Normal, Elevated, High, Very high
export const PM25_1H_NAMES = ['Normal', 'Elevated', 'High', 'Very high']; // NEA's names for those bands, lowest first
// NEA's hourly PM2.5 edges mark where a band STARTS (55 is the bottom of Elevated), unlike PSI_EDGES,
// which are band tops. So a value's band is the count of edges at or below it — the same start
// semantics `lines()` uses to place the chart's "Elevated 55+" labels, so the two cannot disagree.
export function pm25HourIndex(v: number): number { return PM25_1H_EDGES.filter((e) => v >= e).length; }
export function pm25HourBand(v: number): string { return PM25_1H_NAMES[pm25HourIndex(v)]; }
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
