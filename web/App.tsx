import { useEffect, useRef, useState } from 'react';
import type { Region } from '../shared/types.ts';
import { nearestRegion, parseSavedRegion } from '../shared/regions.ts';
import { regionName } from '../shared/format.ts';
import { SCALES } from '../shared/scale.ts';
import type { Scale } from '../shared/scale.ts';
import { getConfig, getNow, useHistory } from './api.ts';
import type { NowResponse } from './api.ts';
import { Sky } from './components/Sky.tsx';
import type { View } from './components/Sky.tsx';
import { Trend } from './components/Trend.tsx';
import { Regions } from './components/Regions.tsx';
import { Calendar } from './components/Calendar.tsx';
import { StaleBanner } from './components/StaleBanner.tsx';
import { RegionPicker } from './components/RegionPicker.tsx';
import { makeCardFile, shareFile, shareText } from './share.ts';

const REFRESH_MS = 10 * 60 * 1000;

// Official explainer pages, checked 2026-10-06.
const EXPLAINERS = [
  { text: 'PSI (NEA)', href: 'https://www.nea.gov.sg/our-services/pollution-control/air-and-coastal-water-quality-monitoring' },
  { text: 'Hourly PM2.5 bands (NEA)', href: 'https://haze.gov.sg/resources/1-hr-pm2.5-readings' },
  { text: 'AQI (US EPA)', href: 'https://www.airnow.gov/aqi/aqi-basics/' },
  { text: 'NowCast (US EPA)', href: 'https://forum.airnowtech.org/t/the-nowcast-for-pm2-5-and-pm10/172' },
];

function loadSavedRegion(): Region | null {
  try { return parseSavedRegion(localStorage.getItem('region')); } catch { return null; }
}

function loadView(): View {
  try { return localStorage.getItem('view') === 'numbers' ? 'numbers' : 'simple'; } catch { return 'simple'; }
}

function loadScale(): Scale {
  try { return localStorage.getItem('scale') === 'aqi' ? 'aqi' : 'psi'; } catch { return 'psi'; }
}

export function App() {
  const [region, setRegion] = useState<Region | null>(loadSavedRegion);
  const [needPicker, setNeedPicker] = useState(false);
  const [data, setData] = useState<{ now: NowResponse } | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [tick, setTick] = useState(0);
  const [view, setView] = useState<View>(loadView);
  const [scale, setScale] = useState<Scale>(loadScale);
  const spec = SCALES[scale];
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [botUrl, setBotUrl] = useState<string | null>(null);
  // One short status line under the hero (locate result, share error), cleared after a few seconds.
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  function flash(msg: string) {
    setNotice(msg);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4000);
  }
  const [locating, setLocating] = useState(false);
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

  function chooseScale(s: Scale) {
    setScale(s);
    try { localStorage.setItem('scale', s); } catch { /* private mode etc. */ }
  }

  // The picker is only for first run (no region yet); afterwards a failed locate keeps the region and says so.
  function locate() {
    const current = region;
    const failed = (why: string) => {
      setLocating(false);
      if (current === null) setNeedPicker(true);
      else flash(`${why} Still showing ${regionName(current)}.`);
    };
    if (!('geolocation' in navigator)) { failed("This browser can't share your location."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const r = nearestRegion(pos.coords.latitude, pos.coords.longitude);
        flash(r === current ? `Already showing ${regionName(r)}, the nearest region.` : `Showing ${regionName(r)}, nearest to you.`);
        choose(r);
      },
      (err) => failed(err.code === err.PERMISSION_DENIED ? 'Location is turned off for this site.' : "Couldn't find your location."),
      { timeout: 10_000, maximumAge: 60 * 60 * 1000 },
    );
  }

  useEffect(() => { if (region === null) locate(); }, []);
  useEffect(() => { getConfig().then((c) => { setPublicUrl(c.publicUrl); setBotUrl(c.botUrl ?? null); }).catch(() => {}); }, []);

  useEffect(() => {
    let live = true;
    getNow()
      .then((now) => { if (live) { setData({ now }); setLoadFailed(false); } })
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
  // From ts, not server ageMinutes, so a cached offline response shows its real age.
  const ageMinutes = data && data.now.ts !== null ? (Date.now() - Date.parse(data.now.ts)) / 60_000 : null;
  const metrics = now !== null && now.ts !== null && region !== null ? now.regions[region] : undefined;
  const value = metrics === undefined ? undefined : spec.value(metrics);
  const band = value === undefined ? null : spec.band(Math.round(value));

  // Card is pre-rendered so the tap can call navigator.share with no await (iOS Safari drops the gesture otherwise).
  const cardKey = region === null || now?.ts == null || value === undefined ? null : `${region}|${scale}|${Math.round(value)}|${now.ts}`;
  const card = useRef<{ key: string; file: File } | null>(null);
  useEffect(() => {
    if (cardKey === null || region === null || now?.ts == null || value === undefined) return;
    let live = true;
    makeCardFile({ spec, region, value: Math.round(value), ts: now.ts })
      .then((file) => { if (live) card.current = { key: cardKey, file }; })
      .catch(() => {});
    return () => { live = false; };
  }, [cardKey]);

  async function share() {
    if (cardKey === null || region === null || now?.ts == null || value === undefined) return;
    const v = Math.round(value);
    try {
      const file = card.current?.key === cardKey ? card.current.file : await makeCardFile({ spec, region, value: v, ts: now.ts });
      await shareFile(file, shareText(spec, region, v), publicUrl);
    } catch {
      flash("Couldn't share. Try again.");
    }
  }

  const message = now === null ? (loadFailed ? "Can't reach the server right now. Trying again shortly." : 'Loading…')
    : now.ts === null ? 'Waiting for first data from NEA'
    : region === null ? (needPicker ? null : 'Finding your region…')
    : value === undefined ? `No ${spec.name} reading for this region yet`
    : null;

  return (
    <div className="page">
      <Sky
        region={region} onRegion={choose} onLocate={locate} onShare={share} view={view} onView={chooseView}
        scale={scale} onScale={chooseScale} band={band} message={message} notice={notice} locating={locating} metrics={metrics} ts={now?.ts ?? null} points={pm25} botUrl={botUrl}
      >
        {now !== null && now.ts !== null && ageMinutes !== null && ageMinutes > 120 && <StaleBanner ts={now.ts} />}
        {needPicker && <RegionPicker onPick={choose} />}
      </Sky>

      <div className="rest">
        {now !== null && now.ts !== null && region !== null && (
          <>
            <Regions now={now} selected={region} onPick={choose} spec={spec} />
            <div className="pair">
              <Trend points={pm25} bandLines={spec.trendLines} caption={spec.trendCaption} />
              <Calendar region={region} tick={tick} spec={spec} />
            </div>
          </>
        )}
        <footer className="footer">
          {/* The band's advisory now renders in the sky, beside the reading it explains. */}
          {scale === 'aqi' && (
            <p>
              AQI here is the US EPA index, worked out from NEA's hourly PM2.5 using NowCast, a weighted average of the last 12 hours.
              It reacts faster than PSI and is not an official reading.
            </p>
          )}
          <p>
            What the numbers mean:{' '}
            {EXPLAINERS.map((l, i) => (
              <span key={l.href}>{i > 0 && ' · '}<a href={l.href} target="_blank" rel="noopener noreferrer">{l.text}</a></span>
            ))}
          </p>
          <p>Data: NEA via <a href="https://data.gov.sg">data.gov.sg</a></p>
        </footer>
      </div>
    </div>
  );
}
