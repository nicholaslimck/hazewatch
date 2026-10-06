import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { REGIONS } from '../../shared/types.ts';
import type { Region } from '../../shared/types.ts';
import { PALETTES } from '../../shared/bands.ts';
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
    if (band) {
      s.setProperty('--sky', dark ? band.darkColor : band.color);
      s.setProperty('--sky-ink', dark ? band.darkOnColor : band.onColor);
    } else {
      s.removeProperty('--sky'); // falls back to the neutral defaults in styles.css
      s.removeProperty('--sky-ink');
    }
  }, [band, dark]);
}

type Props = {
  region: Region | null; onRegion: (r: Region) => void; onLocate: () => void; onShare: () => void;
  view: View; onView: (v: View) => void;
  scale: Scale; onScale: (s: Scale) => void;
  band: PsiBand | null; message: string | null; notice?: string | null;
  metrics: Record<string, number> | undefined; ts: string | null; points: HistoryPoint[] | null;
  children?: ReactNode;
};

export function Sky({ region, onRegion, onLocate, onShare, view, onView, scale, onScale, band, message, notice, metrics, ts, points, children }: Props) {
  useSkyTokens(band);
  const spec = SCALES[scale];
  const value = metrics === undefined ? undefined : spec.value(metrics);
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
          <button type="button" className="locate" onClick={onLocate} aria-label="Use my location" title="Use my location">
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
        {message !== null ? <><p className="quiet">{message}</p>{metrics !== undefined && <p className="hero-meta">{toggle}</p>}</>
          : metrics === undefined || value === undefined || ts === null ? null
          : view === 'simple' ? <HeroSimple value={value} spec={spec} ts={ts} points={points} toggle={toggle} />
          : <HeroNumbers metrics={metrics} value={value} spec={spec} ts={ts} toggle={toggle} />}
        {notice && <p className="quiet" role="status">{notice}</p>}
      </div>
    </section>
  );
}
