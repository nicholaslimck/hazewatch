import { BANDS, psiBand } from './bands.ts';
import type { PsiBand } from './bands.ts';
import { aqiBand, aqiVerdict, pm25ToAqi, AQI_SEGMENTS } from './aqi.ts';
import { bandPosition, PSI_EDGES, SCALE, verdict } from './verdict.ts';

export type Scale = 'psi' | 'aqi';

// Everything the UI needs to show one scale, so components take a spec instead of branching on the scale name.
export type ScaleSpec = {
  name: string; // "PSI" / "AQI"
  source: string; // whose advice the footer quotes
  period: string; // what the headline value averages over, shown after the scale switch
  dayCaption: string;
  gridCaption: string; // header over the Numbers pollutant grid
  trendCaption: string; // what the dashed lines on the 24-hour chart mean
  subIndices: boolean; // PSI's pollutant sub-indices only make sense next to PSI
  value(m: Record<string, number>): number | undefined; // headline value for one region, from /api/now
  band(v: number): PsiBand;
  verdict(v: number): [string, string];
  position(v: number): ReturnType<typeof bandPosition>;
  segments: { from: number; to: number; opacity: number }[];
  history: { metric: string; convert(v: number): number }; // series behind the 90-day calendar
  trendLines: { v: number; label: string }[]; // PM2.5 µg/m³ where a band starts, drawn on the 24-hour chart
  legend: { key: PsiBand['key']; label: string }[];
};

const AQI_EDGES = [50, 100, 150, 200, 300, 400];

export const SCALES: Record<Scale, ScaleSpec> = {
  psi: {
    name: 'PSI',
    source: 'NEA',
    period: '24h average',
    dayCaption: 'Daily mean PSI.',
    gridCaption: 'Sub-index, then concentration',
    trendCaption: "Dashed lines mark NEA's hourly PM2.5 bands.",
    subIndices: true,
    value: (m) => m.psi_twenty_four_hourly,
    band: psiBand,
    verdict,
    position: (v) => bandPosition(v, PSI_EDGES),
    segments: SCALE,
    history: { metric: 'psi_twenty_four_hourly', convert: (v) => v },
    // NEA's 1-hour PM2.5 bands: Normal 0–55, Elevated 56–150, High 151–250, Very high 251+.
    trendLines: [{ v: 55, label: 'Elevated' }, { v: 150, label: 'High' }, { v: 250, label: 'Very high' }],
    legend: BANDS.map((b) => ({ key: b.key, label: b.label })),
  },
  aqi: {
    name: 'AQI',
    source: 'US EPA',
    period: 'right now',
    dayCaption: "AQI from each day's mean PM2.5.",
    gridCaption: 'Concentrations',
    trendCaption: 'Dashed lines mark where AQI bands start.',
    subIndices: false,
    value: (m) => (m.pm25_nowcast === undefined ? undefined : pm25ToAqi(m.pm25_nowcast)),
    band: aqiBand,
    verdict: aqiVerdict,
    position: (v) => bandPosition(v, AQI_EDGES),
    segments: AQI_SEGMENTS,
    history: { metric: 'pm25_one_hourly', convert: pm25ToAqi },
    trendLines: [{ v: 35.4, label: 'Sensitive groups' }, { v: 55.4, label: 'Unhealthy' }, { v: 125.4, label: 'Very unhealthy' }],
    legend: [
      { key: 'good', label: 'Good' },
      { key: 'moderate', label: 'Moderate' },
      { key: 'unhealthy', label: 'Sensitive groups' },
      { key: 'very_unhealthy', label: 'Unhealthy' },
      { key: 'severe', label: 'Very unhealthy' },
      { key: 'hazardous', label: 'Hazardous' },
    ],
  },
};
