import { useEffect, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { REGIONS } from '../../shared/types.ts';
import type { Region } from '../../shared/types.ts';
import { PALETTES, isWarningBand, labelOn, sensitiveAction } from '../../shared/bands.ts';
import type { PsiBand } from '../../shared/bands.ts';
import { parseSavedRegion } from '../../shared/regions.ts';
import { SCALES } from '../../shared/scale.ts';
import type { Scale } from '../../shared/scale.ts';
import type { HistoryPoint } from '../api.ts';
import { fmtDate, regionName } from '../../shared/format.ts';
import { HeroSimple } from './HeroSimple.tsx';
import { HeroNumbers } from './HeroNumbers.tsx';

export type View = 'simple' | 'numbers';

// ARIA radio group keys: arrows move the selection and focus together, so a group is one tab stop.
function radioKeys<T extends string>(e: KeyboardEvent<HTMLElement>, values: readonly T[], current: T, pick: (v: T) => void) {
  const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
  if (step === 0) return;
  e.preventDefault();
  const i = (values.indexOf(current) + step + values.length) % values.length;
  pick(values[i]);
  e.currentTarget.querySelectorAll<HTMLElement>('[role=radio]')[i]?.focus();
}

const DARK_QUERY = '(prefers-color-scheme: dark)';

function usePrefersDark(): boolean {
  const [dark, setDark] = useState(() => matchMedia(DARK_QUERY).matches);
  useEffect(() => {
    const mq = matchMedia(DARK_QUERY);
    const onChange = () => setDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return dark;
}

// Sky colours follow the selected region's band; bar and calendar colours follow the scheme only.
// The drained sky's colour for the status bar, matching .sky.drained's color-mix in styles.css.
const mixHex = (a: string, b: string, p: number) =>
  `rgb(${[1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * p + parseInt(b.slice(i, i + 2), 16) * (1 - p))).join(' ')})`;

function useSkyTokens(band: PsiBand | null, drained: boolean) {
  const dark = usePrefersDark();
  useEffect(() => {
    const s = document.documentElement.style;
    for (const b of PALETTES) {
      s.setProperty(`--bar-${b.key}`, dark ? b.darkBar : b.bar);
      s.setProperty(`--cell-${b.key}`, dark ? b.darkBar : b.bar);
      s.setProperty(`--bar-label-${b.key}`, labelOn(dark ? b.darkBar : b.bar));
    }
    const top = band ? (dark ? band.darkColor : band.color) : null;
    if (band && top !== null) {
      s.setProperty('--sky', top);
      s.setProperty('--sky-band', top); // .sky.drained mixes from this; --sky can't reference itself
      s.setProperty('--sky-ink', dark ? band.darkOnColor : band.onColor);
    } else {
      s.removeProperty('--sky-band');
      s.removeProperty('--sky'); // falls back to the neutral defaults in styles.css
      s.removeProperty('--sky-ink');
    }
    // The Android status bar takes its colour from theme-color, so keep it on the surface under it
    // (the neutral --sky from styles.css when no band is known yet).
    const meta = document.querySelector('meta[name="theme-color"]');
    const overcast = getComputedStyle(document.documentElement).getPropertyValue('--overcast').trim();
    if (meta) meta.setAttribute('content', top === null ? overcast : drained ? mixHex(top, overcast, 0.35) : top);
  }, [band, dark, drained]);
}

type Props = {
  region: Region | null; onRegion: (r: Region) => void; onLocate: () => void; onShare: () => void;
  view: View; onView: (v: View) => void;
  scale: Scale; onScale: (s: Scale) => void;
  band: PsiBand | null; message: string | null; notice?: string | null; locating?: boolean;
  metrics: Record<string, number> | undefined; ts: string | null; points: HistoryPoint[] | null;
  botUrl: string | null;
  retryable?: boolean; onRetry?: () => void;
  // The reading on screen is stale or the server is unreachable: the sky stops being the reading.
  drained?: boolean;
  // The first-run region picker is showing (it replaces the header's region select).
  picking?: boolean;
  // PSI's NowCast estimate when it sits in a worse band than the reading, else null.
  ahead?: number | null;
  // Stale by more than a day: the gap leads the hero and the old verdict steps back to a past-tense line.
  old?: boolean;
  children?: ReactNode;
};

export function Sky({ region, onRegion, onLocate, onShare, view, onView, scale, onScale, band, message, notice, locating = false, metrics, ts, points, botUrl, retryable = false, onRetry, drained = false, old = false, ahead = null, picking = false, children }: Props) {
  useSkyTokens(band, drained);
  const spec = SCALES[scale];
  // Where PSI is heading, and what a sensitive reader should plan for if it gets there.
  const aheadNote = (n: number) => {
    const b = spec.band(n);
    const act = sensitiveAction(b);
    return `Recent hours point to about ${n}, ${b.label.toLowerCase()}.${act ? ` If you're sensitive, plan to ${act}` : ''}`;
  };
  // One line under the number: AQI says why it can differ from PSI; PSI says where it is heading, when worse.
  const note = spec.note || (ahead !== null ? aheadNote(ahead) : '');
  const value = metrics === undefined ? undefined : spec.value(metrics);
  // One advisory line: the band's instruction for sensitive groups. The verdict already tells everyone else
  // what to do, so the band's general advice stays in the scale tooltips rather than repeating it here.
  // Advice for air that is a day gone is no advice for today, so an old reading drops it.
  const advice = band && !old ? band.sensitive || null : null;
  // Stands in for the scale's name on the hero's meta line, so it sits on the number it changes.
  // Kept on screen when this scale has no reading so the user can switch back.
  const toggle = (
    <span className="scale-switch" role="radiogroup" aria-label="Scale" onKeyDown={(e) => radioKeys(e, ['psi', 'aqi'] as const, scale, onScale)}>
      {(['psi', 'aqi'] as const).map((s) => (
        <button key={s} type="button" role="radio" aria-checked={scale === s} tabIndex={scale === s ? 0 : -1} onClick={() => onScale(s)}>
          {SCALES[s].name}
        </button>
      ))}
    </span>
  );
  // The band badge. A discrete state, not a shade: it appears whenever the hero's band is a warning
  // band, so the badge and the surface colour can never disagree. `isWarningBand` is keyed on the band
  // rather than on alertEdges because AQI's 101–150 band is a warning colour below AQI's first alert
  // edge. Its fill is the sky inverted (--sky-ink behind --sky), so it carries the band's own verified
  // contrast pair and needs no new colour.
  const alert = band !== null && isWarningBand(band) ? band : null;
  // The hero's own heading — the verdict in Simple, the reading in Numbers — is the page's h1.
  // Every other state (first run, loading, no reading, server down) still gets one, so the outline
  // is never headless exactly when a new visitor arrives.
  const heroHeading = message === null && metrics !== undefined && value !== undefined && ts !== null;
  return (
    <section className={drained ? 'sky drained' : 'sky'} aria-label="Air quality now">
      <div className="sky-head">
        <div className="where">
          {/* While the first-run picker is open it is the one way to choose; a second picker above it splits the decision. */}
          {!picking && <label className="region">
            <span className="sr-only">Region</span>
            <select value={region ?? ''} onChange={(e) => { const r = parseSavedRegion(e.target.value); if (r) onRegion(r); }}>
              {region === null && <option value="" disabled>Choose region</option>}
              {REGIONS.map((r) => <option key={r} value={r}>{regionName(r)}</option>)}
            </select>
            <span className="region-face" aria-hidden="true">
              {region ? regionName(region) : 'Choose region'}
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
          </label>}
          <button
            type="button" className={locating ? 'locate locating' : 'locate'} onClick={onLocate}
            aria-label={locating ? 'Finding your location' : 'Use my location'} title="Use my location" aria-busy={locating}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
            </svg>
          </button>
          {/* A day-old reading isn't something to pass on as today's air. */}
          {value !== undefined && ts !== null && !old && (
            <button type="button" className="locate" onClick={onShare} aria-label="Share air quality" title="Share air quality">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 15V3M8 7l4-4 4 4" />
                <path d="M5 12v8h14v-8" />
              </svg>
            </button>
          )}
        </div>
        {/* Two views of a reading; with no reading there is nothing to switch between. */}
        {metrics !== undefined && (
          <div className="toggle" role="radiogroup" aria-label="View" onKeyDown={(e) => radioKeys(e, ['simple', 'numbers'] as const, view, onView)}>
            {(['simple', 'numbers'] as const).map((v) => (
              <button key={v} type="button" role="radio" aria-checked={view === v} tabIndex={view === v ? 0 : -1} onClick={() => onView(v)}>
                {v === 'simple' ? 'Simple' : 'Numbers'}
              </button>
            ))}
          </div>
        )}
      </div>
      {/* The page's h1 leads the DOM in every heroless state, so the outline starts at level 1
          (the picker's own h2 renders after it). A first visit, or one the server can't answer, has no
          verdict to lead with, so it says what the app is instead; a returning visitor waiting on a load
          keeps the hidden heading rather than a flash of introduction. */}
      {!heroHeading && (region === null || retryable)
        ? <div>
            <h1 className="verdict">HazeWatch</h1>
            <p className="verdict-advice">Should you go outside? Singapore's air in plain words, from NEA's hourly readings.</p>
          </div>
        : !heroHeading && <h1 className="sr-only">Singapore air quality</h1>}
      {children}
      <div className="sky-body">
        {old && heroHeading && ts !== null && <h1 className="verdict">No reading from NEA since {fmtDate(ts)}.</h1>}
        {/* Drained, the badge is a record of the last reading, not an alarm: outlined, past tense, not announced. */}
        {alert && (drained
          ? <p className="sky-badge past">{alert.label} at last reading</p>
          : <p className="sky-badge" role="status">{alert.label} air</p>)}
        {message !== null ? <>
            {/* Offline: the card is the retry control, so recovery needs no second button. */}
            {retryable && onRetry
              ? <button type="button" className="quiet retry" onClick={onRetry}>{message}</button>
              : <p className="quiet">{message}</p>}
            {metrics !== undefined && <p className="hero-meta">{toggle}</p>}
          </>
          : metrics === undefined || value === undefined || ts === null ? null
          : view === 'simple' ? <HeroSimple value={value} spec={spec} ts={ts} points={points} toggle={toggle} note={note} advice={advice} drained={drained} old={old} />
          : <HeroNumbers metrics={metrics} value={value} spec={spec} ts={ts} toggle={toggle} note={note} advice={advice} drained={drained} old={old} />}
        {/* The live region stays mounted so screen readers announce each new notice. */}
        <div role="status" aria-live="polite">{notice && <p className="quiet notice">{notice}</p>}</div>
        {/* Simple view sets the advice under its verdict; elsewhere it follows the reading. */}
        {/* Both hero views set the advice under their verdict; this line is for a band shown without a hero. */}
        {advice && !heroHeading && <p className="sky-advice">{advice}</p>}
        {/* The only way to be told the air turned, made findable from the page that exists to be watched. */}
        {botUrl && (
          <p className="sky-alerts">
            <a href={botUrl} target="_blank" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2 11 13" />
                <path d="M22 2 15 22 11 13 2 9 22 2z" />
              </svg>
              Get alerts on Telegram
            </a>
          </p>
        )}
      </div>
    </section>
  );
}
