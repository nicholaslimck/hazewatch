import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { trend } from '../../shared/bands.ts';
import type { ScaleSpec } from '../../shared/scale.ts';
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

// What one segment of the bar means, e.g. "Unhealthy · PSI 101–200" plus that band's advice.
function describe(spec: ScaleSpec, i: number): { title: string; advice: string } {
  const s = spec.segments[i];
  const lo = s.from === 0 ? 0 : s.from + 1;
  const range = i === spec.segments.length - 1 ? `${lo}+` : `${lo}–${s.to}`;
  const band = spec.band(lo);
  return { title: `${band.label} · ${spec.name} ${range}`, advice: band.advice };
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
    : (t.s.from + t.s.to) / 2 < 120 ? { left: pct(t.s.from) }
    : (t.s.from + t.s.to) / 2 > 280 ? { right: `calc(100% - ${pct(t.s.to)})` }
    : { left: pct((t.s.from + t.s.to) / 2), transform: 'translateX(-50%)' };
  return (
    <div className="scale-wrap" ref={wrap}>
      <svg className="scale" width="100%" height="16" role="img" aria-label={`${spec.name} ${v} on a scale to 400`}>
        {/* Segments in 0–400 units so each gets a fixed inset; the marker stays in % so it isn't stretched. */}
        <svg viewBox="0 0 400 6" preserveAspectRatio="none" y="5" width="100%" height="6">
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
            style={{ left: pct(s.from), width: `${((s.to - s.from) / 400) * 100}%` }}
            aria-label={`${d.title}. ${d.advice}`}
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
      {t && (
        <span className="scale-tip" style={tipStyle} aria-hidden="true">
          <strong>{t.title}</strong>
          {t.advice}
        </span>
      )}
    </div>
  );
}

export function HeroSimple({ value, spec, ts, points, toggle }: { value: number; spec: ScaleSpec; ts: string; points: HistoryPoint[] | null; toggle: ReactNode }) {
  const v = Math.round(value);
  const [line1, line2] = spec.verdict(v);
  const sentence = trendSentence(points);
  return (
    <div className="hero">
      <h1 className="verdict">{line1}<br />{line2}</h1>
      <p className="hero-meta">{toggle} {v}, {spec.position(v)} of {spec.band(v).label.toLowerCase()}</p>
      <ScaleBar v={v} spec={spec} />
      <p className="hero-foot">{sentence ? `${sentence}, updated ${fmtTime(ts)}` : `Updated ${fmtTime(ts)}`}</p>
    </div>
  );
}
