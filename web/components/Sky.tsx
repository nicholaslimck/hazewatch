import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { REGIONS } from '../../shared/types.ts';
import type { Region } from '../../shared/types.ts';
import { PALETTES, SENSITIVE_NOTE } from '../../shared/bands.ts';
import type { PsiBand } from '../../shared/bands.ts';
import { parseSavedRegion } from '../../shared/regions.ts';
import { SCALES } from '../../shared/scale.ts';
import type { Scale } from '../../shared/scale.ts';
import type { HistoryPoint } from '../api.ts';
import { regionName } from '../../shared/format.ts';
import { HeroSimple } from './HeroSimple.tsx';
import { HeroNumbers } from './HeroNumbers.tsx';

export type View = 'simple' | 'numbers';

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
function useSkyTokens(band: PsiBand | null) {
  const dark = usePrefersDark();
  useEffect(() => {
    const s = document.documentElement.style;
    for (const b of PALETTES) {
      s.setProperty(`--bar-${b.key}`, dark ? b.darkBar : b.bar);
      s.setProperty(`--cell-${b.key}`, dark ? b.darkBar : b.bar);
    }
    const top = band ? (dark ? band.darkColor : band.color) : null;
    if (band && top !== null) {
      s.setProperty('--sky', top);
      s.setProperty('--sky-ink', dark ? band.darkOnColor : band.onColor);
    } else {
      s.removeProperty('--sky'); // falls back to the neutral defaults in styles.css
      s.removeProperty('--sky-ink');
    }
    // The Android status bar takes its colour from theme-color, so keep it on the surface under it
    // (the neutral --sky from styles.css when no band is known yet).
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', top ?? getComputedStyle(document.documentElement).getPropertyValue('--sky').trim());
  }, [band, dark]);
}

type Props = {
  region: Region | null; onRegion: (r: Region) => void; onLocate: () => void; onShare: () => void;
  view: View; onView: (v: View) => void;
  scale: Scale; onScale: (s: Scale) => void;
  band: PsiBand | null; message: string | null; notice?: string | null; locating?: boolean;
  metrics: Record<string, number> | undefined; ts: string | null; points: HistoryPoint[] | null;
  botUrl: string | null;
  children?: ReactNode;
};

export function Sky({ region, onRegion, onLocate, onShare, view, onView, scale, onScale, band, message, notice, locating = false, metrics, ts, points, botUrl, children }: Props) {
  useSkyTokens(band);
  const spec = SCALES[scale];
  const value = metrics === undefined ? undefined : spec.value(metrics);
  // The band's advisory, sitting under the reading it explains. Bands with no advice of their own
  // (AQI's Very unhealthy) would otherwise render a bare "advice: ." clause, so skip that part.
  const advice = band && [band.advice && `${spec.source} advice: ${band.advice}.`, band.sensitiveNote && SENSITIVE_NOTE].filter(Boolean).join(' ');
  // Stands in for the scale's name on the hero's meta line, so it sits on the number it changes.
  // Kept on screen when this scale has no reading so the user can switch back.
  const toggle = (
    <span className="scale-switch" role="radiogroup" aria-label="Scale">
      {(['psi', 'aqi'] as const).map((s) => (
        <button key={s} type="button" role="radio" aria-checked={scale === s} onClick={() => onScale(s)}>
          {SCALES[s].name}
        </button>
      ))}
    </span>
  );
  // The hero's own heading — the verdict in Simple, the reading in Numbers — is the page's h1.
  // Every other state (first run, loading, no reading, server down) still gets one, so the outline
  // is never headless exactly when a new visitor arrives.
  const heroHeading = message === null && metrics !== undefined && value !== undefined && ts !== null;
  return (
    <section className="sky" aria-label="Air quality now">
      <div className="sky-head">
        <div className="where">
          <label className="region">
            <span className="sr-only">Region</span>
            <select value={region ?? ''} onChange={(e) => { const r = parseSavedRegion(e.target.value); if (r) onRegion(r); }}>
              {region === null && <option value="" disabled>Choose region</option>}
              {REGIONS.map((r) => <option key={r} value={r}>{regionName(r)}</option>)}
            </select>
            <span className="region-face" aria-hidden="true">{region ? regionName(region) : 'Choose region'} ▾</span>
          </label>
          <button
            type="button" className={locating ? 'locate locating' : 'locate'} onClick={onLocate}
            aria-label={locating ? 'Finding your location' : 'Use my location'} title="Use my location" aria-busy={locating}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
            </svg>
          </button>
          {value !== undefined && ts !== null && (
            <button type="button" className="locate" onClick={onShare} aria-label="Share air quality" title="Share air quality">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 15V3M8 7l4-4 4 4" />
                <path d="M5 12v8h14v-8" />
              </svg>
            </button>
          )}
        </div>
        <div className="toggle" role="radiogroup" aria-label="View">
          {(['simple', 'numbers'] as const).map((v) => (
            <button key={v} type="button" role="radio" aria-checked={view === v} onClick={() => onView(v)}>
              {v === 'simple' ? 'Simple' : 'Numbers'}
            </button>
          ))}
        </div>
      </div>
      {children}
      <div className="sky-body">
        {!heroHeading && <h1 className="sr-only">Singapore air quality</h1>}
        {message !== null ? <><p className="quiet">{message}</p>{metrics !== undefined && <p className="hero-meta">{toggle}</p>}</>
          : metrics === undefined || value === undefined || ts === null ? null
          : view === 'simple' ? <HeroSimple value={value} spec={spec} ts={ts} points={points} toggle={toggle} />
          : <HeroNumbers metrics={metrics} value={value} spec={spec} ts={ts} toggle={toggle} />}
        {/* The live region stays mounted so screen readers announce each new notice. */}
        <div role="status" aria-live="polite">{notice && <p className="quiet notice">{notice}</p>}</div>
        {advice && <p className="sky-advice">{advice}</p>}
        {/* The only way to be told the air turned, made findable from the page that exists to be watched. */}
        {botUrl && (
          <p className="sky-alerts">
            <a href={botUrl} target="_blank" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
