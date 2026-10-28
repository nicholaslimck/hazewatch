import { useEffect, useRef, useState } from 'react';
import type { Region } from '../shared/types.ts';
import { nearestRegion, parseSavedRegion } from '../shared/regions.ts';
import { regionName, fmtAge, fmtWhen } from '../shared/format.ts';
import { SCALES } from '../shared/scale.ts';
import { psiNowcast } from '../shared/verdict.ts';
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
import { deepLink, readState, writeSearch } from './url.ts';
import { pageTitle } from './title.ts';

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
  // A link (a bookmark, or one a friend shared) wins over what this device last saved; the saved
  // prefs win over the defaults. Read once, on the first render.
  const initial = readState(window.location.search);
  const [region, setRegion] = useState<Region | null>(() => initial.region ?? loadSavedRegion());
  const [needPicker, setNeedPicker] = useState(false);
  const [data, setData] = useState<{ now: NowResponse } | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [tick, setTick] = useState(0);
  // The last reading actually received, so a failed fetch can say how old the screen is.
  const [lastGoodTs, setLastGoodTs] = useState<string | null>(null);
  // Consecutive failed fetches; each one lengthens the retry delay until the server answers.
  const [failStreak, setFailStreak] = useState(0);
  const [view, setView] = useState<View>(() => initial.view ?? loadView());
  const [scale, setScale] = useState<Scale>(() => initial.scale ?? loadScale());
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
  // Every region's last 24 hours on the current scale, for the trend line in each region row.
  const regionHistory = useHistory('24h', spec.history.metric, region === null ? null : 'all', tick);

  function choose(r: Region) {
    setRegion(r);
    setNeedPicker(false);
    try { localStorage.setItem('region', r); } catch { /* private mode etc. */ }
  }

  // A pick from the map or rows changes a hero that, on a phone, has scrolled out of view; bring it back
  // so the new verdict is seen. Wide screens keep the sky pinned beside the list, so they stay put.
  function pickBelow(r: Region) {
    choose(r);
    // Keyboard users keep their place in the list, where the row's pressed state confirms the pick.
    if (matchMedia('(max-width: 899px)').matches && !document.activeElement?.matches(':focus-visible')) {
      window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
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
      (err) => failed(err.code === err.PERMISSION_DENIED ? 'Location is off for this site. Allow it in your browser settings to use it.' : "Couldn't find your location."),
      { timeout: 10_000, maximumAge: 60 * 60 * 1000 },
    );
  }

  useEffect(() => { if (region === null) locate(); }, []);
  useEffect(() => { getConfig().then((c) => { setPublicUrl(c.publicUrl); setBotUrl(c.botUrl ?? null); }).catch(() => {}); }, []);

  useEffect(() => {
    let live = true;
    getNow()
      .then((now) => {
        if (!live) return;
        setData({ now });
        setLoadFailed(false);
        setFailStreak(0);
        if (now.ts !== null) setLastGoodTs(now.ts);
      })
      .catch(() => { if (live) { setLoadFailed(true); setFailStreak((n) => n + 1); } }); // keep last good data on screen
    return () => { live = false; };
  }, [tick]);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') setTick((t) => t + 1); };
    const id = setInterval(refresh, REFRESH_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', refresh); };
  }, []);

  // A failed fetch retries on its own, backing off from 30s toward the normal cadence and resetting
  // the moment the server answers, so a dropped connection heals without the user doing anything.
  // The offline card is also tappable, for when they would rather not wait.
  useEffect(() => {
    if (!loadFailed) return;
    const id = setTimeout(() => setTick((t) => t + 1), Math.min(REFRESH_MS, 30_000 * 2 ** Math.max(0, failStreak - 1)));
    return () => clearTimeout(id);
  }, [loadFailed, failStreak, tick]);

  // The address bar always reflects the current view, so it can be copied or bookmarked at any
  // moment. replaceState, not push: this is not a navigation the back button should step through.
  useEffect(() => {
    const search = writeSearch({ region, view, scale });
    if (search !== window.location.search) window.history.replaceState(null, '', `${window.location.pathname}${search}`);
  }, [region, view, scale]);

  // Going offline or back online refetches at once, so the screen says so without waiting for the timer.
  useEffect(() => {
    const refetch = () => setTick((t) => t + 1);
    window.addEventListener('online', refetch);
    window.addEventListener('offline', refetch);
    return () => { window.removeEventListener('online', refetch); window.removeEventListener('offline', refetch); };
  }, []);

  const now = data?.now ?? null;
  // From ts, not server ageMinutes, so a cached offline response shows its real age.
  const ageMinutes = data && data.now.ts !== null ? (Date.now() - Date.parse(data.now.ts)) / 60_000 : null;
  // A reading is on screen but can't be vouched for as current: the server didn't answer (including
  // when the service worker answered from its cache instead), or NEA hasn't published in over two hours.
  // Only a reading actually on screen can be in doubt: on first run, before a region is picked, the
  // stale line would say "Showing …" over nothing.
  const shownTs = now?.ts != null && region !== null && now.regions[region] !== undefined ? now.ts : null;
  const offline = shownTs !== null && (loadFailed || now?.fromCache === true);
  const stale = shownTs !== null && ageMinutes !== null && ageMinutes > 120;
  // Over a day old, the gap is the news: the hero's heading says it, so the stale line steps aside.
  const old = stale && ageMinutes !== null && ageMinutes > 24 * 60;
  const age = ageMinutes === null ? '' : fmtAge(ageMinutes);
  const doubt = shownTs === null ? null
    : offline ? `Can't reach the server. Showing the reading from ${fmtWhen(shownTs)}${stale ? `, ${age} old` : ''}.`
    : old ? null
    : stale ? `No new reading from NEA for ${age}. Showing ${fmtWhen(shownTs)}.`
    : null;
  const drained = offline || stale;
  const metrics = now !== null && now.ts !== null && region !== null ? now.regions[region] : undefined;
  const value = metrics === undefined ? undefined : spec.value(metrics);
  const band = value === undefined ? null : spec.band(Math.round(value));
  // PSI only: when the NowCast estimate sits in a worse band than NEA's 24-hour PSI, say where it points.
  // Not on a stale or unreachable reading, where "recent hours" would be old hours.
  const estimate = scale === 'psi' && !drained && metrics !== undefined ? psiNowcast(metrics) : undefined;
  const ahead = estimate !== undefined && band !== null && spec.band(estimate) !== band && estimate > (value ?? Infinity) ? Math.round(estimate) : null;

  // The tab/window title names the current reading — the number is what a tab strip shows.
  useEffect(() => { document.title = pageTitle(region, spec.name, value); }, [region, spec.name, value]);

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
      // The link reproduces the region/scale/view being shared, not just the site root.
      const text = shareText(spec, region, v);
      const link = deepLink(publicUrl, { region, view, scale });
      if ((await shareFile(file, text, link)) === 'downloaded') {
        // No share sheet here (most desktops), so the picture downloads; the words and link would
        // otherwise be lost, so they go to the clipboard, and either way the reader is told.
        const copied = await navigator.clipboard?.writeText(link ? `${text} ${link}` : text).then(() => true, () => false);
        flash(!copied ? 'Saved the picture to your downloads.' : `Saved the picture to your downloads and copied the ${link ? 'link' : 'caption'}.`);
      }
    } catch {
      flash("Couldn't share. Try again.");
    }
  }

  const retryable = now === null && loadFailed;
  const message = now === null
    ? (loadFailed
      ? `Can't reach the server right now.${lastGoodTs !== null ? ` Last update ${fmtWhen(lastGoodTs)}.` : ''} Trying again shortly, or tap to retry now.`
      : 'Loading…')
    : now.ts === null ? 'Waiting for first data from NEA'
    : region === null ? (needPicker ? null : 'Finding your region…')
    : value === undefined ? `No ${spec.name} reading for this region yet`
    : null;

  return (
    <main className={drained ? 'page drained' : 'page'}>
      <Sky
        region={region} onRegion={choose} onLocate={locate} onShare={share} view={view} onView={chooseView}
        scale={scale} onScale={chooseScale} band={band} message={message} notice={notice} locating={locating} metrics={metrics} ts={now?.ts ?? null} points={pm25} botUrl={botUrl}
        retryable={retryable} onRetry={() => setTick((t) => t + 1)} drained={drained} old={old} ahead={ahead} picking={needPicker && now !== null}
      >
        {/* Stays mounted so screen readers announce the line when it appears. */}
        <div role="status">{doubt && <StaleBanner text={doubt} onRetry={offline ? () => setTick((t) => t + 1) : undefined} />}</div>
        {/* Wait for the server: picking a region it can't serve would still show nothing. */}
        {needPicker && now !== null && <RegionPicker onPick={choose} now={now} spec={spec} />}
      </Sky>

      <div className="rest">
        {now !== null && now.ts !== null && region !== null && (
          <>
            <Regions now={now} selected={region} onPick={pickBelow} spec={spec} asOf={drained ? now.ts : null} history={regionHistory} />
            <div className="pair">
              <Trend points={pm25} spec={spec} doubt={drained} until={old ? now.ts : null} />
              <Calendar region={region} tick={tick} spec={spec} until={old ? now.ts : null} />
            </div>
          </>
        )}
        <footer className="footer">
          {ahead !== null && (
            <p>
              “Recent hours point to…” is HazeWatch's estimate, not NEA's official PSI. It follows NEA's method but
              swaps the 24-hour PM2.5 average for the NowCast average AQI uses (the last 12 hours, weighted toward the
              latest), so it shows where PSI is heading. It usually turns hours before NEA's PSI does, and turns back
              more often.
            </p>
          )}
          {/* On both scales, so a first-time reader can tell what the PSI/AQI switch chooses between. */}
          <p>
            PSI is NEA's official index, averaged over 24 hours. AQI is the US EPA's index, worked out here from NEA's
            hourly PM2.5 using NowCast (a weighted average of the last 12 hours), so it moves faster than PSI and is not
            an official reading.
          </p>
          <p>
            What the numbers mean:{' '}
            {EXPLAINERS.map((l, i) => (
              <span key={l.href}>{i > 0 && ' · '}<a href={l.href} target="_blank" rel="noopener noreferrer">{l.text}</a></span>
            ))}
          </p>
          <p>Data: NEA via <a href="https://data.gov.sg">data.gov.sg</a></p>
        </footer>
      </div>
    </main>
  );
}
