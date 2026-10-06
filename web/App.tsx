import { useEffect, useState } from 'react';
import { REGIONS } from '../shared/types.ts';
import type { Region } from '../shared/types.ts';
import { nearestRegion, parseSavedRegion } from '../shared/regions.ts';
import { getNow } from './api.ts';
import type { NowResponse } from './api.ts';
import { fmtTime, regionName } from './format.ts';
import { Hero } from './components/Hero.tsx';
import { Trend } from './components/Trend.tsx';
import { Regions } from './components/Regions.tsx';
import { Calendar } from './components/Calendar.tsx';
import { Details } from './components/Details.tsx';
import { StaleBanner } from './components/StaleBanner.tsx';
import { RegionPicker } from './components/RegionPicker.tsx';

const REFRESH_MS = 10 * 60 * 1000;

function loadSavedRegion(): Region | null {
  try { return parseSavedRegion(localStorage.getItem('region')); } catch { return null; }
}

export function App() {
  const [region, setRegion] = useState<Region | null>(loadSavedRegion);
  const [needPicker, setNeedPicker] = useState(false);
  // `at` is when this response arrived, so staleness keeps growing if later fetches fail.
  const [data, setData] = useState<{ now: NowResponse; at: number } | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [tick, setTick] = useState(0);

  function choose(r: Region) {
    setRegion(r);
    setNeedPicker(false);
    try { localStorage.setItem('region', r); } catch { /* private mode etc. */ }
  }

  function locate() {
    if (!('geolocation' in navigator)) { setNeedPicker(true); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => choose(nearestRegion(pos.coords.latitude, pos.coords.longitude)),
      () => setNeedPicker(true),
      { timeout: 10_000, maximumAge: 60 * 60 * 1000 },
    );
  }

  useEffect(() => { if (region === null) locate(); }, []);

  useEffect(() => {
    let live = true;
    getNow()
      .then((now) => { if (live) { setData({ now, at: Date.now() }); setLoadFailed(false); } })
      .catch(() => { if (live) setLoadFailed(true); }); // keep last good data on screen
    return () => { live = false; };
  }, [tick]);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') setTick((t) => t + 1); };
    const id = setInterval(refresh, REFRESH_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', refresh); };
  }, []);

  const now = data?.now ?? null;
  const ageMinutes = data && data.now.ageMinutes !== null
    ? data.now.ageMinutes + (Date.now() - data.at) / 60_000
    : null;

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1>{region ? regionName(region) : 'Air quality'}</h1>
          {now?.ts && <p className="muted">Updated {fmtTime(now.ts)}</p>}
        </div>
        <div className="controls">
          <select
            aria-label="Region"
            value={region ?? ''}
            onChange={(e) => { const r = parseSavedRegion(e.target.value); if (r) choose(r); }}
          >
            {region === null && <option value="" disabled>Choose region</option>}
            {REGIONS.map((r) => <option key={r} value={r}>{regionName(r)}</option>)}
          </select>
          <button type="button" className="icon-btn" onClick={locate} aria-label="Use my location" title="Use my location">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
            </svg>
          </button>
        </div>
      </header>

      <main>
        {needPicker && <RegionPicker onPick={choose} />}
        {now === null ? (
          <p className="card message">{loadFailed ? "Can't reach the server right now. Trying again shortly." : 'Loading…'}</p>
        ) : now.ts === null ? (
          <p className="card message">Waiting for first data from NEA</p>
        ) : (
          <>
            {ageMinutes !== null && ageMinutes > 120 && <StaleBanner ts={now.ts} />}
            {region === null ? (
              !needPicker && <p className="card message">Finding your region…</p>
            ) : (
              <div className="grid">
                <div className="col">
                  <Hero value={now.regions[region]?.psi_twenty_four_hourly} />
                  <Trend region={region} tick={tick} />
                </div>
                <div className="col">
                  <Regions now={now} selected={region} />
                  <Calendar key={region} region={region} tick={tick} />
                  <Details metrics={now.regions[region]} />
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="footer muted">
        Data: NEA via data.gov.sg · <a href="https://data.gov.sg">Source</a>
      </footer>
    </div>
  );
}
