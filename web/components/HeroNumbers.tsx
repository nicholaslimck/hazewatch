import { psiBand } from '../../shared/bands.ts';
import { dominantPollutant } from '../../shared/verdict.ts';
import { fmtTime } from '../format.ts';
import { SCALE } from './HeroSimple.tsx';

const H = 130;
const UG = 'µg/m³';
// Display order. NO₂ has no sub-index, so its concentration is the large value.
const POLLUTANTS: { key: string; name: string; index: string | null; conc: string; unit: string }[] = [
  { key: 'pm25', name: 'Fine particles PM2.5', index: 'pm25_sub_index', conc: 'pm25_one_hourly', unit: UG },
  { key: 'pm10', name: 'Coarse particles PM10', index: 'pm10_sub_index', conc: 'pm10_twenty_four_hourly', unit: UG },
  { key: 'o3', name: 'Ozone O₃', index: 'o3_sub_index', conc: 'o3_eight_hour_max', unit: UG },
  { key: 'no2', name: 'Nitrogen dioxide NO₂', index: null, conc: 'no2_one_hour_max', unit: UG },
  { key: 'so2', name: 'Sulphur dioxide SO₂', index: 'so2_sub_index', conc: 'so2_twenty_four_hourly', unit: UG },
  { key: 'co', name: 'Carbon monoxide CO', index: 'co_sub_index', conc: 'co_eight_hour_max', unit: 'mg/m³' },
];

const y = (v: number) => H - (Math.min(Math.max(v, 0), 400) / 400) * H;

function Gauge({ psi }: { psi: number }) {
  return (
    <svg className="gauge" width="14" height={H} viewBox={`0 0 14 ${H}`} aria-hidden="true">
      {SCALE.map((s) => (
        <rect key={s.from} x="0" y={y(s.to)} width="14" height={y(s.from) - y(s.to)} fill="currentColor" fillOpacity={s.opacity} />
      ))}
      <rect x="-3" y={y(psi) - 1.5} width="20" height="3" fill="currentColor" />
    </svg>
  );
}

export function HeroNumbers({ metrics, psi, ts }: { metrics: Record<string, number>; psi: number; ts: string }) {
  const v = Math.round(psi);
  const dominant = dominantPollutant(metrics);
  const dominantName = POLLUTANTS.find((p) => p.key === dominant)?.name;
  return (
    <div className="hero">
      <div className="n-top">
        <Gauge psi={v} />
        <div>
          <p className="psi-big">{v}</p>
          <p className="hero-meta">24h PSI, {psiBand(v).label.toLowerCase()}</p>
        </div>
      </div>
      {dominantName && <p className="hero-meta">Set by {dominantName[0].toLowerCase() + dominantName.slice(1)}</p>}
      <dl className="pol">
        {POLLUTANTS.map((p) => {
          const big = p.index === null ? metrics[p.conc] : metrics[p.index];
          if (big === undefined) return null;
          const conc = p.index === null ? undefined : metrics[p.conc];
          return (
            <div key={p.key} className={p.key === dominant ? 'pol-item dominant' : 'pol-item'}>
              <dt>{p.name}</dt>
              <dd>
                <span className="pol-big">{p.index === null ? big : Math.round(big)}</span>
                {p.index === null ? <span className="pol-unit"> {p.unit}</span>
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
