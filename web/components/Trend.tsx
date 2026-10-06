import type { Region } from '../../shared/types.ts';
import { trend } from '../../shared/bands.ts';
import { useHistory } from '../api.ts';
import type { HistoryPoint } from '../api.ts';
import { fmtHour } from '../format.ts';

const HOUR = 3600_000;
const W = 300;
const H = 60;
const PAD = 4;

// Splits hourly points into runs of consecutive hours, so gaps stay gaps.
function segments(points: HistoryPoint[]): HistoryPoint[][] {
  const out: HistoryPoint[][] = [];
  let prev = NaN;
  for (const p of points) {
    const t = Date.parse(p.ts);
    if (out.length === 0 || t - prev > HOUR) out.push([]);
    out[out.length - 1].push(p);
    prev = t;
  }
  return out;
}

function Sparkline({ points }: { points: HistoryPoint[] }) {
  const t0 = Date.parse(points[0].ts);
  const t1 = Date.parse(points[points.length - 1].ts);
  const vals = points.map((p) => p.value);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const x = (ts: string) => ((Date.parse(ts) - t0) / (t1 - t0 || 1)) * W;
  const y = (v: number) => H - PAD - ((v - lo) / (hi - lo || 1)) * (H - 2 * PAD);
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="1h PM2.5 over the last 24 hours">
      {segments(points).map((seg) =>
        seg.length === 1 ? (
          <circle key={seg[0].ts} cx={x(seg[0].ts)} cy={y(seg[0].value)} r="2" fill="currentColor" />
        ) : (
          <polyline
            key={seg[0].ts}
            points={seg.map((p) => `${x(p.ts).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        ),
      )}
    </svg>
  );
}

export function Trend({ region, tick }: { region: Region; tick: number }) {
  const points = useHistory('24h', 'pm25_one_hourly', region, tick);
  if (!points || points.length === 0) return null;
  const last = points[points.length - 1];
  const target = Date.parse(last.ts) - 3 * HOUR;
  const earlier = points.find((p) => Date.parse(p.ts) === target);
  const dir = trend(last.value, earlier?.value);
  if (dir === null || earlier === undefined) return null;

  const since = fmtHour(earlier.ts);
  const delta = Math.abs(Math.round(last.value - earlier.value));
  const text = dir === 'rising' ? `Up ${delta} µg/m³ since ${since}`
    : dir === 'falling' ? `Down ${delta} µg/m³ since ${since}`
    : `Steady since ${since}`;
  const arrow = dir === 'rising' ? '↑' : dir === 'falling' ? '↓' : '→';
  return (
    <section className="card" aria-labelledby="trend-title">
      <h2 id="trend-title">PM2.5 trend</h2>
      <p className="trend"><span aria-hidden="true">{arrow}</span> {text}</p>
      <Sparkline points={points} />
      <p className="muted small">1h PM2.5, last 24 hours · now {Math.round(last.value)} µg/m³</p>
    </section>
  );
}
