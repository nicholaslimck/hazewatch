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

export function psiBand(v: number): PsiBand {
  if (v <= 50) return GOOD;
  if (v <= 100) return MODERATE;
  if (v <= 200) return UNHEALTHY;
  if (v <= 300) return VERY_UNHEALTHY;
  return HAZARDOUS;
}

export function pm25Band(v: number): 1 | 2 | 3 | 4 {
  if (v <= 55) return 1;
  if (v <= 150) return 2;
  if (v <= 250) return 3;
  return 4;
}

export function trend(latest: number | undefined, threeHoursAgo: number | undefined): 'rising' | 'falling' | 'steady' | null {
  if (latest === undefined || threeHoursAgo === undefined) return null;
  const d = latest - threeHoursAgo;
  return d >= 10 ? 'rising' : d <= -10 ? 'falling' : 'steady';
}
