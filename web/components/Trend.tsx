import type { HistoryPoint } from '../api.ts';
import { fmtHour } from '../format.ts';

const HOUR = 3600_000;
const WINDOW = 24 * HOUR;
const W = 300;
const H = 120;

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

// The SVG stretches to its box (non-scaling strokes); text stays HTML so it keeps its pixel size.
const LABEL_GAP = 14; // px; a band label closer than this to the one below it is dropped

// `bandLines` are where the selected scale's bands start, in µg/m³ PM2.5.
export function Trend({ points, bandLines, caption }: { points: HistoryPoint[] | null; bandLines: { v: number; label: string }[]; caption: string }) {
  if (!points || points.length === 0) return null;
  const last = points[points.length - 1];
  const t1 = Date.parse(last.ts);
  const t0 = t1 - WINDOW;
  const top = Math.max(160, ...points.map((p) => p.value));
  const x = (ts: string) => ((Date.parse(ts) - t0) / WINDOW) * W;
  const y = (v: number) => H - (v / top) * H;
  const ticks = [4, 3, 2, 1, 0].map((k) => (k === 0 ? 'now' : fmtHour(new Date(t1 - k * 6 * HOUR).toISOString())));
  const lines = bandLines.filter((l) => l.v <= top);
  // Lines are ascending, so each is drawn higher than the last; keep a label only if it clears the previous kept one.
  let lastY = Infinity;
  const labelled = lines.filter((l) => {
    const py = (y(l.v) / H) * 120; // chart is 120px tall
    if (lastY - py < LABEL_GAP) return false;
    lastY = py;
    return true;
  });
  return (
    <section aria-labelledby="trend-title">
      <h2 id="trend-title">Last 24 hours</h2>
      <p className="caption">Fine particles PM2.5, hourly, in µg/m³. Now {Math.round(last.value)}. {caption}</p>
      <div className="chart">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Fine particles PM2.5 over the last 24 hours">
          {lines.map(({ v }) => (
            <line key={v} x1="0" x2={W} y1={y(v)} y2={y(v)} className="ref" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          ))}
          {segments(points).map((seg) => (
            <polyline
              key={seg[0].ts}
              points={(seg.length === 1 ? [seg[0], seg[0]] : seg).map((p) => `${x(p.ts).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')}
              fill="none"
              className="line"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        {labelled.map(({ v, label }) => (
          <span key={v} className="ref-label" style={{ top: `${(y(v) / H) * 100}%` }}>{label} {Math.round(v)}+</span>
        ))}
      </div>
      <div className="ticks" aria-hidden="true">
        {ticks.map((t, i) => <span key={i}>{t}</span>)}
      </div>
    </section>
  );
}
