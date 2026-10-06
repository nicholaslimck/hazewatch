import { useEffect, useState } from 'react';
import type { Region } from '../shared/types.ts';
import { nearestRegion, parseSavedRegion } from '../shared/regions.ts';
import { psiBand } from '../shared/bands.ts';
import { getNow, useHistory } from './api.ts';
import type { NowResponse } from './api.ts';
import { Sky } from './components/Sky.tsx';
import type { View } from './components/Sky.tsx';
import { Trend } from './components/Trend.tsx';
import { Regions } from './components/Regions.tsx';
import { Calendar } from './components/Calendar.tsx';
import { StaleBanner } from './components/StaleBanner.tsx';
import { RegionPicker } from './components/RegionPicker.tsx';

const REFRESH_MS = 10 * 60 * 1000;
const SENSITIVE = ' Elderly, children, pregnant women and people with heart or lung conditions should take extra care.';

function loadSavedRegion(): Region | null {
  try { return parseSavedRegion(localStorage.getItem('region')); } catch { return null; }
}

function loadView(): View {
  try { return localStorage.getItem('view') === 'numbers' ? 'numbers' : 'simple'; } catch { return 'simple'; }
}

export function App() {
  const [region, setRegion] = useState<Region | null>(loadSavedRegion);
  const [needPicker, setNeedPicker] = useState(false);
  // `at` is when this response arrived, so staleness keeps growing if later fetches fail.
  const [data, setData] = useState<{ now: NowResponse; at: number } | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [tick, setTick] = useState(0);
  const [view, setView] = useState<View>(loadView);
  // Shared by the hero's trend sentence and the "Last 24 hours" chart, so it's fetched once.
  const pm25 = useHistory('24h', 'pm25_one_hourly', region, tick);

  function choose(r: Region) {
    setRegion(r);
    setNeedPicker(false);
    try { localStorage.setItem('region', r); } catch { /* private mode etc. */ }
  }

  function chooseView(v: View) {
    setView(v);
    try { localStorage.setItem('view', v); } catch { /* private mode etc. */ }
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
  const metrics = now !== null && now.ts !== null && region !== null ? now.regions[region] : undefined;
  const psi = metrics?.psi_twenty_four_hourly;
  const band = psi === undefined ? null : psiBand(Math.round(psi));
  const message = now === null ? (loadFailed ? "Can't reach the server right now. Trying again shortly." : 'Loading…')
    : now.ts === null ? 'Waiting for first data from NEA'
    : region === null ? (needPicker ? null : 'Finding your region…')
    : psi === undefined ? 'No PSI reading for this region yet'
    : null;

  return (
    <div className="page">
      <Sky
        region={region} onRegion={choose} onLocate={locate} view={view} onView={chooseView}
        band={band} message={message} metrics={metrics} ts={now?.ts ?? null} points={pm25}
      >
        {now !== null && now.ts !== null && ageMinutes !== null && ageMinutes > 120 && <StaleBanner ts={now.ts} />}
        {needPicker && <RegionPicker onPick={choose} />}
      </Sky>

      <div className="rest">
        {now !== null && now.ts !== null && region !== null && (
          <>
            <Regions now={now} selected={region} onPick={choose} />
            <div className="pair">
              <Trend points={pm25} />
              <Calendar key={region} region={region} tick={tick} />
            </div>
          </>
        )}
        <footer className="footer">
          {band && <p>NEA advice: {band.advice}.{band.sensitiveNote && SENSITIVE}</p>}
          <p>Data: NEA via <a href="https://data.gov.sg">data.gov.sg</a></p>
        </footer>
      </div>
    </div>
  );
}
