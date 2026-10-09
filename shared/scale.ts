import { BANDS, psiBand, PSI_EDGES, PM25_1H_EDGES, PM25_1H_NAMES } from './bands.ts';
import type { PsiBand } from './bands.ts';
import { aqiBand, aqiVerdict, pm25ToAqi, AQI_EDGES, AQI_PM25_EDGES, AQI_SEGMENTS } from './aqi.ts';
import { bandPosition, SCALE, verdict } from './verdict.ts';

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
  alertEdges: number[]; // the scale values where alert levels 1, 2, 3 start, in the scale's own units
};

const AQI_LEGEND: ScaleSpec['legend'] = [
  { key: 'good', label: 'Good' },
  { key: 'moderate', label: 'Moderate' },
  { key: 'unhealthy', label: 'Unhealthy for sensitive groups' },
  { key: 'very_unhealthy', label: 'Unhealthy' },
  { key: 'severe', label: 'Very unhealthy' },
  { key: 'hazardous', label: 'Hazardous' },
];

// A chart line at each band's top edge, labelled with the band that starts above it.
const lines = (edges: readonly number[], names: readonly string[]) => edges.map((v, i) => ({ v, label: names[i + 1] }));

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
    position: (v) => bandPosition(v, PSI_EDGES), // not PSI_VERDICT_EDGES: "middle of unhealthy" means the whole band
    segments: SCALE,
    // PSI's Unhealthy / Very unhealthy / Hazardous lower edges; the Moderate band doesn't alert.
    alertEdges: [100, 200, 300],
    history: { metric: 'psi_twenty_four_hourly', convert: (v) => v },
    trendLines: lines(PM25_1H_EDGES, PM25_1H_NAMES),
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
    // AQI's own Unhealthy / Very unhealthy / Hazardous starts. 151 is PM2.5 55.5 µg/m³, the same air
    // as PSI 101, so the scale changes the number you read, not when you get warned. To warn from the
    // sensitive-groups band instead, prepend 100 to this list.
    alertEdges: [150, 200, 300],
    history: { metric: 'pm25_one_hourly', convert: pm25ToAqi },
    // Skip the Good/Moderate line (9 µg/m³ sits on the chart floor) and Hazardous (off the chart top in practice).
    trendLines: lines(AQI_PM25_EDGES, AQI_LEGEND.map((l) => l.label)).slice(1, 4),
    legend: AQI_LEGEND,
  },
};
