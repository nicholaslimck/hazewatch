import { BANDS, SEVERE, bandIndex, segments } from './bands.ts';
import type { PsiBand } from './bands.ts';

// US EPA PM2.5 breakpoints, 2024 revision (AQI Technical Assistance Document, May 2024).
const BREAKPOINTS = [
  { cLo: 0, cHi: 9.0, iLo: 0, iHi: 50 },
  { cLo: 9.1, cHi: 35.4, iLo: 51, iHi: 100 },
  { cLo: 35.5, cHi: 55.4, iLo: 101, iHi: 150 },
  { cLo: 55.5, cHi: 125.4, iLo: 151, iHi: 200 },
  { cLo: 125.5, cHi: 225.4, iLo: 201, iHi: 300 },
  { cLo: 225.5, cHi: 325.4, iLo: 301, iHi: 500 },
];

// µg/m³ -> AQI. EPA truncates PM2.5 to 0.1 first; above 500 the last segment's slope continues.
export function pm25ToAqi(c: number): number {
  const t = Math.floor(Math.max(c, 0) * 10 + 1e-6) / 10;
  const b = BREAKPOINTS.find((x) => t <= x.cHi) ?? BREAKPOINTS[BREAKPOINTS.length - 1];
  return Math.round(((b.iHi - b.iLo) / (b.cHi - b.cLo)) * (t - b.cLo) + b.iLo);
}

// EPA NowCast for PM2.5. `hours[i]` is the concentration i hours before the latest hour (undefined = missing).
// Weighted mean of the last 12 hours: steady air gives a flat mean, fast change leans on recent hours.
export function nowcast(hours: (number | undefined)[]): number | null {
  const h = hours.slice(0, 12);
  if (h.slice(0, 3).filter((v) => v !== undefined).length < 2) return null; // EPA: 2 of the last 3 hours must be valid
  const vals = h.filter((v): v is number => v !== undefined);
  const max = Math.max(...vals);
  const w = max === 0 ? 1 : Math.max(0.5, 1 - (max - Math.min(...vals)) / max);
  let num = 0;
  let den = 0;
  h.forEach((v, i) => {
    if (v !== undefined) { num += v * w ** i; den += w ** i; }
  });
  return num / den;
}

// Six AQI bands, six sky palettes (PSI's five plus SEVERE).
const base = (key: PsiBand['key']) => BANDS.find((b) => b.key === key)!;
const AQI_BANDS: readonly PsiBand[] = [
  { ...base('good'), label: 'Good', advice: 'A great day to be active outside', sensitiveNote: false },
  { ...base('moderate'), label: 'Moderate', advice: 'Unusually sensitive people: consider shorter, less intense outdoor activity', sensitiveNote: false },
  { ...base('unhealthy'), label: 'Unhealthy for sensitive groups', advice: 'Sensitive groups: make outdoor activity shorter and less intense, and take more breaks', sensitiveNote: false },
  { ...base('very_unhealthy'), label: 'Unhealthy', advice: 'Sensitive groups: consider moving activity indoors. Everyone else: keep outdoor activity shorter and less intense', sensitiveNote: false },
  { ...SEVERE, label: 'Very unhealthy', advice: 'Sensitive groups: avoid all outdoor physical activity. Everyone else: limit outdoor physical activity', sensitiveNote: false },
  { ...base('hazardous'), label: 'Hazardous', advice: 'Sensitive groups: stay indoors and keep activity light. Everyone else: avoid all outdoor physical activity', sensitiveNote: false },
];

// Edges come from the breakpoint table: AQI index tops (50, 100, 150, 200, 300) and the PM2.5 µg/m³ where each band ends.
export const AQI_EDGES = BREAKPOINTS.slice(0, -1).map((b) => b.iHi);
export const AQI_PM25_EDGES = BREAKPOINTS.slice(0, -1).map((b) => b.cHi);

export function aqiBand(v: number): PsiBand {
  return AQI_BANDS[bandIndex(v, AQI_EDGES)];
}

const AQI_VERDICTS: [string, string][] = [
  ['Clear skies.', 'A good day to be outside.'],
  ['A little hazy.', 'Fine for a run.'],
  ['Hazy.', 'Sensitive groups, take it easy.'],
  ['Hazy.', 'Skip the long run today.'],
  ['Very hazy.', 'Avoid exercising outdoors.'],
  ['Hazardous.', 'Stay indoors as much as you can.'],
];

export function aqiVerdict(v: number): [string, string] {
  return AQI_VERDICTS[bandIndex(v, AQI_EDGES)];
}

export const AQI_SEGMENTS = segments(AQI_EDGES, [0.18, 0.3, 0.38, 0.46, 0.56, 0.66]);
