import { psiBand, trend } from '../../shared/bands.ts';
import { verdict, bandPosition, SCALE } from '../../shared/verdict.ts';
import type { HistoryPoint } from '../api.ts';
import { fmtHour, fmtTime } from '../format.ts';

const HOUR = 3600_000;
const pct = (v: number) => `${(Math.min(Math.max(v, 0), 400) / 400) * 100}%`;

// "Clearing since 3pm" etc., or null when there's no reading from exactly 3 hours before the latest.
function trendSentence(points: HistoryPoint[] | null): string | null {
  if (!points || points.length === 0) return null;
  const last = points[points.length - 1];
  const target = Date.parse(last.ts) - 3 * HOUR;
  const earlier = points.find((p) => Date.parse(p.ts) === target);
  const dir = trend(last.value, earlier?.value);
  if (dir === null || earlier === undefined) return null;
  const since = fmtHour(earlier.ts);
  return dir === 'falling' ? `Clearing since ${since}` : dir === 'rising' ? `Getting hazier since ${since}` : `Steady since ${since}`;
}

export function HeroSimple({ psi, ts, points }: { psi: number; ts: string; points: HistoryPoint[] | null }) {
  const v = Math.round(psi);
  const [line1, line2] = verdict(v);
  const sentence = trendSentence(points);
  return (
    <div className="hero">
      <h1 className="verdict">{line1}<br />{line2}</h1>
      <p className="hero-meta">PSI {v}, {bandPosition(v)} of {psiBand(v).label.toLowerCase()}</p>
      <svg className="scale" width="100%" height="16" role="img" aria-label={`PSI ${v} on a scale to 400`}>
        {SCALE.map((s) => (
          <rect key={s.from} x={pct(s.from)} y="5" width={pct(s.to - s.from)} height="6" fill="currentColor" fillOpacity={s.opacity} />
        ))}
        <circle cx={pct(v)} cy="8" r="6" fill="currentColor" />
      </svg>
      <p className="hero-foot">{sentence ? `${sentence}, updated ${fmtTime(ts)}` : `Updated ${fmtTime(ts)}`}</p>
    </div>
  );
}
