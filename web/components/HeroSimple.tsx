import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { scaleFraction, SCALE_TOP, trend } from '../../shared/bands.ts';
import type { ScaleSpec } from '../../shared/scale.ts';
import type { HistoryPoint } from '../api.ts';
import { fmtHour, fmtWhen } from '../../shared/format.ts';

const HOUR = 3600_000;
const pct = (v: number) => `${scaleFraction(v) * 100}%`;

// "Fine particles rising since 3pm" etc., or null when there's no reading from exactly 3 hours before the latest.
// It names its measure (hourly PM2.5) because the scale beside it can be PSI, a 24-hour average that
// barely moves: an unnamed "Getting hazier" sat next to region rows reading "steady" for the same air.
function trendSentence(points: HistoryPoint[] | null): string | null {
  if (!points || points.length === 0) return null;
  const last = points[points.length - 1];
  const target = Date.parse(last.ts) - 3 * HOUR;
  const earlier = points.find((p) => Date.parse(p.ts) === target);
  const dir = trend(last.value, earlier?.value);
  if (dir === null || earlier === undefined) return null;
  const since = fmtHour(earlier.ts);
  return `Fine particles ${dir === 'falling' ? 'falling' : dir === 'rising' ? 'rising' : 'steady'} since ${since}`;
}

// What one segment of the bar means, e.g. "Unhealthy · PSI 101–200" plus that band's advice.
function describe(spec: ScaleSpec, i: number): { title: string; advice: string } {
  const s = spec.segments[i];
  const lo = s.from === 0 ? 0 : s.from + 1;
  const range = i === spec.segments.length - 1 ? `${lo}+` : `${lo}–${s.to}`;
  const band = spec.band(lo);
  return { title: `${band.label} · ${spec.name} ${range}`, advice: [band.advice, band.sensitive].filter(Boolean).join(' ') };
}

// The band scale, with a tooltip per segment on mouse hover, tap (tap again or elsewhere to close) or keyboard focus.
function ScaleBar({ v, spec }: { v: number; spec: ScaleSpec }) {
  const [tip, setTip] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (tip === null) return;
    const close = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setTip(null); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [tip]);
  const segs = spec.segments;
  const t = tip === null ? null : { ...describe(spec, tip), s: segs[tip] };
  // Keep the tooltip on screen: segments near an edge align to that edge instead of centring.
  const tipStyle = t === null ? undefined
    : (t.s.from + t.s.to) / 2 < SCALE_TOP * 0.3 ? { left: pct(t.s.from) }
    : (t.s.from + t.s.to) / 2 > SCALE_TOP * 0.7 ? { right: `calc(100% - ${pct(t.s.to)})` }
    : { left: pct((t.s.from + t.s.to) / 2), transform: 'translateX(-50%)' };
  // One tab stop for the whole bar: the band the reading is in, with arrows (and Home/End) moving between
  // bands. Five stops of full advisory sentences sat between the verdict and everything below it.
  const current = segs.findIndex((s) => v <= s.to);
  const home = current < 0 ? segs.length - 1 : current;
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const hits = [...e.currentTarget.querySelectorAll<HTMLElement>('.scale-hit')];
    const at = hits.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    const to = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? Math.min(at + 1, hits.length - 1)
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? Math.max(at - 1, 0)
      : e.key === 'Home' ? 0 : e.key === 'End' ? hits.length - 1 : null;
    if (to === null) return;
    e.preventDefault();
    hits[to].focus();
  };
  return (
    <div className="scale-wrap" ref={wrap} role="group" aria-label={`${spec.name} bands`} onKeyDown={onKeyDown}>
      <svg className="scale" width="100%" height="16" role="img" aria-label={`${spec.name} ${v} on a scale to ${SCALE_TOP}`}>
        {/* Segments in scale units so each gets a fixed inset; the marker stays in % so it isn't stretched. */}
        <svg viewBox={`0 0 ${SCALE_TOP} 6`} preserveAspectRatio="none" y="5" width="100%" height="6">
          {segs.map((s) => (
            <rect key={s.from} x={s.from + 2} width={s.to - s.from - 4} height="6" rx="3" fill="currentColor" fillOpacity={s.opacity} />
          ))}
        </svg>
        <circle cx={pct(v)} cy="8" r="6" fill="currentColor" />
      </svg>
      {segs.map((s, i) => {
        const d = describe(spec, i);
        return (
          <button
            key={s.from}
            type="button"
            className="scale-hit"
            tabIndex={i === home ? 0 : -1}
            style={{ left: pct(s.from), width: `${((s.to - s.from) / SCALE_TOP) * 100}%` }}
            aria-label={`${d.title}. ${d.advice}`.trim()}
            aria-expanded={tip === i}
            onPointerEnter={(e) => { if (e.pointerType === 'mouse') setTip(i); }}
            onPointerLeave={(e) => { if (e.pointerType === 'mouse') setTip(null); }}
            // Keyboard focus opens it; a tap also focuses the button, so only :focus-visible counts or the tap's click would close it again.
            onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) setTip(i); }}
            onBlur={() => setTip(null)}
            // Mouse is handled by hover; taps and Enter/Space toggle.
            onClick={(e) => { if ((e.nativeEvent as PointerEvent).pointerType !== 'mouse') setTip((cur) => (cur === i ? null : i)); }}
            onKeyDown={(e) => { if (e.key === 'Escape') setTip(null); }}
          />
        );
      })}
      {/* Band edges in numbers, so where a band starts doesn't depend on telling two shades apart. */}
      <div className="scale-ticks" aria-hidden="true">
        {segs.slice(1).map((s) => <span key={s.from} style={{ left: pct(s.from) }}>{s.from}</span>)}
      </div>
      {t && (
        <span className="scale-tip" style={tipStyle} aria-hidden="true">
          <strong>{t.title}</strong>
          {t.advice}
        </span>
      )}
    </div>
  );
}

export function HeroSimple({ value, spec, ts, points, toggle, note, advice, drained = false, old = false }: { value: number; spec: ScaleSpec; ts: string; points: HistoryPoint[] | null; toggle: ReactNode; note: string; advice: string | null; drained?: boolean; old?: boolean }) {
  const v = Math.round(value);
  const [line1, line2] = spec.verdict(v);
  // A trend in the present tense ("Fine particles rising since 8am") would be news about air that has moved on.
  const sentence = drained ? null : trendSentence(points);
  return (
    <div className="hero">
      {/* Over a day old, Sky's heading carries the gap and the verdict is kept as what was said then. */}
      {/* Stale by hours or unreachable: the instruction is dated, so it reads as what held then, not an order for now. */}
      {old ? <p className="verdict-past">Last reading: {line1} {line2}</p>
        : <h1 className="verdict">{drained && <span className="verdict-when">At {fmtWhen(ts)}:</span>}{line1}<br />{line2}</h1>}
      {/* Straight under the verdict: for sensitive groups this line is the verdict. */}
      {advice && <p className="verdict-advice">{advice}</p>}
      <p className="hero-meta">{toggle} {v}, {spec.position(v)} of {spec.band(v).label.toLowerCase()}</p>
      {/* Said where the number is, so switching scales doesn't look like the air changed. */}
      {note && <p className="hero-meta">{note}</p>}
      <ScaleBar v={v} spec={spec} />
      <p className="hero-foot">
        {drained ? 'Reading from ' : sentence ? `${sentence}, updated ` : 'Updated '}
        {/* Times never break before "am"; NEA publishes hourly, so the next reading is due about an hour on. */}
        <span className="nowrap">{fmtWhen(ts)}</span>
        {!drained && <>. Next around <span className="nowrap">{fmtHour(new Date(Date.parse(ts) + HOUR).toISOString())}</span>.</>}
      </p>
    </div>
  );
}
