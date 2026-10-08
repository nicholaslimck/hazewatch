import type { ReactNode } from 'react';
import type { ScaleSpec } from '../../shared/scale.ts';
import { scaleFraction } from '../../shared/bands.ts';
import { dominantPollutant } from '../../shared/verdict.ts';
import { fmtTime } from '../../shared/format.ts';

const H = 130;
const UG = 'µg/m³';
// Display order. NO₂ has no sub-index, so its concentration is the large value.
const POLLUTANTS: { key: string; name: string; index: string | null; conc: string; unit: string }[] = [
  // Concentrations use the same averaging period as their sub-index (PM2.5: 24h, not the 1-hour reading).
  { key: 'pm25', name: 'Fine particles PM2.5', index: 'pm25_sub_index', conc: 'pm25_twenty_four_hourly', unit: UG },
  { key: 'pm10', name: 'Coarse particles PM10', index: 'pm10_sub_index', conc: 'pm10_twenty_four_hourly', unit: UG },
  { key: 'o3', name: 'Ozone O₃', index: 'o3_sub_index', conc: 'o3_eight_hour_max', unit: UG },
  { key: 'no2', name: 'Nitrogen dioxide NO₂', index: null, conc: 'no2_one_hour_max', unit: UG },
  { key: 'so2', name: 'Sulphur dioxide SO₂', index: 'so2_sub_index', conc: 'so2_twenty_four_hourly', unit: UG },
  { key: 'co', name: 'Carbon monoxide CO', index: 'co_sub_index', conc: 'co_eight_hour_max', unit: 'mg/m³' },
];

const y = (v: number) => H - scaleFraction(v) * H;

function Gauge({ value, segments }: { value: number; segments: ScaleSpec['segments'] }) {
  return (
    <svg className="gauge" width="14" height={H} viewBox={`0 0 14 ${H}`} aria-hidden="true">
      {segments.map((s) => (
        <rect key={s.from} x="0" y={y(s.to)} width="14" height={y(s.from) - y(s.to)} fill="currentColor" fillOpacity={s.opacity} />
      ))}
      <rect x="-3" y={y(value) - 1.5} width="20" height="3" fill="currentColor" />
    </svg>
  );
}

export function HeroNumbers({ metrics, value, spec, ts, toggle }: { metrics: Record<string, number>; value: number; spec: ScaleSpec; ts: string; toggle: ReactNode }) {
  const v = Math.round(value);
  // Same pollutants in the same order in both modes. PSI leads each row with its sub-index; AQI is PM2.5 only,
  // so its PM2.5 row leads with the NowCast and the other rows lead with their concentration.
  const dominant = spec.subIndices ? dominantPollutant(metrics) : 'pm25';
  const dominantName = POLLUTANTS.find((p) => p.key === dominant)?.name;
  const nowcast = metrics.pm25_nowcast;
  const lastHour = metrics.pm25_one_hourly;
  return (
    <div className="hero">
      <div className="n-top">
        <Gauge value={v} segments={spec.segments} />
        <div>
          <h1 className="psi-big">{v}</h1>
          <p className="hero-meta">{toggle} {spec.period}, {spec.band(v).label.toLowerCase()}</p>
        </div>
      </div>
      {dominantName && <p className="hero-meta">Set by {dominantName[0].toLowerCase() + dominantName.slice(1)}</p>}
      <p className="pol-head">{spec.gridCaption}</p>
      <dl className="pol">
        {POLLUTANTS.map((p) => {
          const showIndex = spec.subIndices && p.index !== null;
          const isNowcast = !spec.subIndices && p.key === 'pm25' && nowcast !== undefined;
          const big = isNowcast ? nowcast : showIndex ? metrics[p.index!] : metrics[p.conc];
          if (big === undefined) return null;
          const conc = showIndex ? metrics[p.conc] : undefined;
          return (
            <div key={p.key} className={p.key === dominant ? 'pol-item dominant' : 'pol-item'}>
              <dt>{p.name}</dt>
              <dd>
                <span className="pol-big">{showIndex ? Math.round(big) : big}</span>
                {isNowcast ? <>
                    <span className="pol-unit"> {p.unit} NowCast</span>
                    {lastHour !== undefined && <span className="pol-sub">{lastHour} {p.unit} last hour</span>}
                  </>
                  : !showIndex ? <span className="pol-unit"> {p.unit}</span>
                  : conc !== undefined && <span className="pol-unit"> {conc} {p.unit}</span>}
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="hero-foot small">Updated {fmtTime(ts)}</p>
    </div>
  );
}
