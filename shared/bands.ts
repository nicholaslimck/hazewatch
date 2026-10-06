export type PsiBand = {
  key: 'good' | 'moderate' | 'unhealthy' | 'very_unhealthy' | 'hazardous';
  label: string; advice: string; sensitiveNote: boolean; color: string; onColor: string;
};

const on = '#1A1A1A';
const GOOD: PsiBand = { key: 'good', label: 'Good', advice: 'Normal activities', sensitiveNote: false, color: '#7BC67B', onColor: on };
const MODERATE: PsiBand = { key: 'moderate', label: 'Moderate', advice: 'Normal activities', sensitiveNote: false, color: '#7FB3E0', onColor: on };
const UNHEALTHY: PsiBand = { key: 'unhealthy', label: 'Unhealthy', advice: 'Reduce prolonged or strenuous outdoor exertion', sensitiveNote: true, color: '#F2C94C', onColor: on };
const VERY_UNHEALTHY: PsiBand = { key: 'very_unhealthy', label: 'Very unhealthy', advice: 'Avoid prolonged or strenuous outdoor exertion', sensitiveNote: true, color: '#F2994A', onColor: on };
const HAZARDOUS: PsiBand = { key: 'hazardous', label: 'Hazardous', advice: 'Minimise outdoor activity', sensitiveNote: true, color: '#EB5757', onColor: on };

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
