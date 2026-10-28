import type { HistoryPoint } from '../api.ts';
import { fmtDate, fmtHour, fmtWhen } from '../../shared/format.ts';
import { gapNote, segments } from '../series.ts';
import { placeLabels } from '../labels.ts';
import type { ScaleSpec } from '../../shared/scale.ts';

const HOUR = 3600_000;
const WINDOW = 24 * HOUR;
const W = 300;
const H = 120;


// The SVG stretches to its box (non-scaling strokes); text stays HTML so it keeps its pixel size.
const LABEL_GAP = 18; // px; a 12px label's line box, so a label closer than this to the one below would overlap it and is dropped

// `bandLines` are where the selected scale's bands start, in µg/m³ PM2.5.
// `doubt`: the reading on screen can't be vouched for as current (stale, or the server didn't answer).
// `until`: set when it is over a day old, so the heading says when the 24 hours end.
export function Trend({ points, spec, doubt = false, until = null }: { points: HistoryPoint[] | null; spec: ScaleSpec; doubt?: boolean; until?: string | null }) {
  const bandLines = spec.trendLines;
  if (!points || points.length === 0) return null;
  const last = points[points.length - 1];
  const t1 = Date.parse(last.ts);
  const t0 = t1 - WINDOW;
  const top = Math.max(160, ...points.map((p) => p.value));
  const x = (ts: string) => ((Date.parse(ts) - t0) / WINDOW) * W;
  const y = (v: number) => H - (v / top) * H;
  // The right edge is the latest point; it is only "now" while that point is fresh (the app's 2-hour stale line).
  const live = !doubt && Date.now() - t1 <= 2 * HOUR;
  const ticks = [4, 3, 2, 1, 0].map((k) => (k === 0 && live ? 'now' : fmtHour(new Date(t1 - k * 6 * HOUR).toISOString())));
  const lines = bandLines.filter((l) => l.v <= top);
  // Top line first; viewBox height equals the chart's 120px CSS height, so y is in px.
  const topDown = [...lines].reverse();
  const places = placeLabels(topDown.map((l) => y(l.v)), LABEL_GAP, H);
  const labelled = topDown.map((l, i) => ({ ...l, place: places[i] })).filter((l) => l.place !== null);
  return (
    <section aria-labelledby="trend-title">
      <h2 id="trend-title">{until ? `24 hours to ${fmtDate(until)}` : 'Last 24 hours'}</h2>
      <p className="caption">Fine particles PM2.5, hourly, in µg/m³. {live ? 'Now' : `At ${fmtWhen(last.ts)},`} {Math.round(last.value)} — {spec.hourBand(last.value)}. {spec.trendCaption} {gapNote(points.map((p) => p.ts))}</p>
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
        {labelled.map(({ v, label, place }) => (
          <span key={v} className={place === 'below' ? 'ref-label below' : 'ref-label'} style={{ top: `${(y(v) / H) * 100}%` }}>{label} {Math.round(v)}+</span>
        ))}
      </div>
      <div className="ticks" aria-hidden="true">
        {ticks.map((t, i) => <span key={i}>{t}</span>)}
      </div>
      {/* The current band in the chart's own vocabulary, so it can never disagree with the dashed lines.
          No colour: a band-coloured dot read as a second verdict beside the hero's. */}
      <p className="now-chip">{spec.hourChip}{spec.hourBand(last.value)}</p>
    </section>
  );
}
