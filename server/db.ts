import { DatabaseSync } from 'node:sqlite';
import type { Reading, Region } from '../shared/types.ts';
import { nowcast } from '../shared/aqi.ts';

export type NowResponse = { ts: string | null; ageMinutes: number | null; regions: Partial<Record<Region, Record<string, number>>> };
export type HistoryPoint = { ts: string; region: Region; value: number };
export type Sub = { chatId: number; region: Region; notifiedLevel: number };
export type Store = {
  upsert(rs: Reading[]): void;
  count(): number;
  now(nowMs?: number): NowResponse;
  history(range: '24h' | '7d' | '90d', metric: string, region?: Region): HistoryPoint[];
  completeDays(metric: string): Set<string>;
  subscribe(chatId: number, region: Region, notifiedLevel: number): void;
  unsubscribe(chatId: number): void;
  setNotified(chatId: number, level: number): void;
  subscriptions(): Sub[];
  subscriptionCount(): number;
  close(): void;
};

const HOUR = 3600_000;
// Stored ts all carry +08:00, so format cut-offs the same way to keep string comparison valid.
const sgtIso = (ms: number) => new Date(ms + 8 * HOUR).toISOString().slice(0, 19) + '+08:00';

export function openDb(path: string): Store {
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE IF NOT EXISTS readings (
    ts     TEXT NOT NULL,
    region TEXT NOT NULL,
    metric TEXT NOT NULL,
    value  REAL NOT NULL,
    PRIMARY KEY (ts, region, metric)
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS subscriptions (
    chat_id        INTEGER PRIMARY KEY,
    region         TEXT NOT NULL,
    notified_level INTEGER NOT NULL,
    created_at     TEXT NOT NULL
  )`);
  const ins = db.prepare(
    'INSERT INTO readings (ts, region, metric, value) VALUES (?, ?, ?, ?) ON CONFLICT(ts, region, metric) DO UPDATE SET value = excluded.value',
  );

  // ponytail: single-process, single-writer cache. If a second process ever
  // writes readings, invalidate via a version column instead.
  let nowCache: { ts: string | null; regions: NowResponse['regions'] } | null = null;

  // The now() payload only changes when readings change, so compute it once and
  // reuse it until the next upsert.
  const computeNow = (): { ts: string | null; regions: NowResponse['regions'] } => {
    const top = db.prepare('SELECT MAX(ts) AS ts FROM readings').get() as { ts: string | null };
    if (!top.ts) return { ts: null, regions: {} };
    const rows = db
      .prepare(
        // Bare column with MAX() takes the value from the max row; the 7-day bound avoids a full scan.
        `SELECT region, metric, value, MAX(ts) AS ts FROM readings WHERE ts >= ? GROUP BY region, metric`,
      )
      .all(sgtIso(Date.parse(top.ts) - 7 * 24 * HOUR)) as { region: Region; metric: string; value: number }[];
    const regions: NowResponse['regions'] = {};
    for (const x of rows) (regions[x.region] ??= {})[x.metric] = x.value;

    // pm25_nowcast (µg/m³): EPA NowCast over the last 12 hours of hourly PM2.5, counted back from the newest hour in the db.
    const newestPm = (db.prepare("SELECT MAX(ts) AS ts FROM readings WHERE metric = 'pm25_one_hourly'").get() as { ts: string | null }).ts;
    if (newestPm) {
      const newestMs = Date.parse(newestPm);
      const hourly = db
        .prepare("SELECT region, ts, value FROM readings WHERE metric = 'pm25_one_hourly' AND ts > ?")
        .all(sgtIso(newestMs - 12 * HOUR)) as { region: Region; ts: string; value: number }[];
      const byRegion = new Map<Region, (number | undefined)[]>();
      for (const p of hourly) {
        const hours = byRegion.get(p.region) ?? [];
        hours[Math.round((newestMs - Date.parse(p.ts)) / HOUR)] = p.value;
        byRegion.set(p.region, hours);
      }
      for (const [region, hours] of byRegion) {
        const nc = nowcast(hours);
        if (nc !== null) (regions[region] ??= {}).pm25_nowcast = Math.floor(nc * 10 + 1e-6) / 10; // EPA truncates to 0.1
      }
    }
    return { ts: top.ts, regions };
  };

  return {
    upsert(rs) {
      nowCache = null; // single writer; a rolled-back batch just recomputes once
      db.exec('BEGIN');
      try {
        for (const x of rs) ins.run(x.ts, x.region, x.metric, x.value);
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    count() {
      return (db.prepare('SELECT COUNT(*) AS n FROM readings').get() as { n: number }).n;
    },
    now(nowMs = Date.now()) {
      const c = (nowCache ??= computeNow());
      return {
        ts: c.ts,
        // ageMinutes depends on wall-clock, not stored data, so it stays live.
        ageMinutes: c.ts ? Math.round((nowMs - Date.parse(c.ts)) / 60000) : null,
        regions: c.regions,
      };
    },
    history(range, metric, region) {
      const newest = (db.prepare('SELECT MAX(ts) AS ts FROM readings WHERE metric = ?').get(metric) as { ts: string | null }).ts;
      if (!newest) return [];
      const regionSql = region ? ' AND region = ?' : '';
      const args = region ? [metric, region] : [metric];
      if (range === '90d') {
        const first = sgtIso(Date.parse(newest) - 89 * 24 * HOUR).slice(0, 10);
        return db
          .prepare(
            `SELECT substr(ts,1,10) AS ts, region, AVG(value) AS value FROM readings
             WHERE metric = ?${regionSql} AND substr(ts,1,10) >= ?
             GROUP BY substr(ts,1,10), region ORDER BY 1, region`,
          )
          .all(...args, first)
          .map((p) => ({ ...p, value: Math.round((p.value as number) * 10) / 10 })) as HistoryPoint[]; // 0.1 keeps PM2.5 daily means precise enough for AQI band edges
      }
      const cutoff = sgtIso(Date.parse(newest) - (range === '24h' ? 24 : 168) * HOUR);
      return db
        .prepare(`SELECT ts, region, value FROM readings WHERE metric = ?${regionSql} AND ts > ? ORDER BY ts, region`)
        .all(...args, cutoff) as HistoryPoint[];
    },
    completeDays(metric) {
      // All 24 hourly readings present. A partial day (server down for some hours) isn't complete, so backfill refetches it.
      const rows = db
        .prepare('SELECT substr(ts,1,10) AS d FROM readings WHERE metric = ? GROUP BY d HAVING COUNT(DISTINCT ts) >= 24')
        .all(metric) as { d: string }[];
      return new Set(rows.map((x) => x.d));
    },
    subscribe(chatId, region, notifiedLevel) {
      // Upsert leaves created_at alone.
      db.prepare(
        'INSERT INTO subscriptions (chat_id, region, notified_level, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(chat_id) DO UPDATE SET region = excluded.region, notified_level = excluded.notified_level',
      ).run(chatId, region, notifiedLevel, sgtIso(Date.now()));
    },
    unsubscribe(chatId) {
      db.prepare('DELETE FROM subscriptions WHERE chat_id = ?').run(chatId);
    },
    setNotified(chatId, level) {
      db.prepare('UPDATE subscriptions SET notified_level = ? WHERE chat_id = ?').run(level, chatId);
    },
    subscriptions() {
      return db.prepare('SELECT chat_id AS chatId, region, notified_level AS notifiedLevel FROM subscriptions ORDER BY chat_id').all().map((x) => ({ ...x })) as Sub[]; // node:sqlite rows have a null prototype
    },
    subscriptionCount() {
      return (db.prepare('SELECT COUNT(*) AS n FROM subscriptions').get() as { n: number }).n;
    },
    close() {
      db.close();
    },
  };
}
