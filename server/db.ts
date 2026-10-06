import { DatabaseSync } from 'node:sqlite';
import type { Reading, Region } from '../shared/types.ts';

export type NowResponse = { ts: string | null; ageMinutes: number | null; regions: Partial<Record<Region, Record<string, number>>> };
export type HistoryPoint = { ts: string; region: Region; value: number };
export type Store = {
  upsert(rs: Reading[]): void;
  count(): number;
  now(nowMs?: number): NowResponse;
  history(range: '24h' | '7d' | '90d', metric: string, region?: Region): HistoryPoint[];
  daysWithData(): Set<string>;
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
  const ins = db.prepare(
    'INSERT INTO readings (ts, region, metric, value) VALUES (?, ?, ?, ?) ON CONFLICT(ts, region, metric) DO UPDATE SET value = excluded.value',
  );

  return {
    upsert(rs) {
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
      const top = db.prepare('SELECT MAX(ts) AS ts FROM readings').get() as { ts: string | null };
      if (!top.ts) return { ts: null, ageMinutes: null, regions: {} };
      const rows = db
        .prepare(
          `SELECT region, metric, value FROM readings r
           WHERE ts = (SELECT MAX(ts) FROM readings WHERE region = r.region AND metric = r.metric)`,
        )
        .all() as { region: Region; metric: string; value: number }[];
      const regions: NowResponse['regions'] = {};
      for (const x of rows) (regions[x.region] ??= {})[x.metric] = x.value;
      return { ts: top.ts, ageMinutes: Math.round((nowMs - Date.parse(top.ts)) / 60000), regions };
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
          .map((p) => ({ ...p, value: Math.round(p.value as number) })) as HistoryPoint[];
      }
      const cutoff = sgtIso(Date.parse(newest) - (range === '24h' ? 24 : 168) * HOUR);
      return db
        .prepare(`SELECT ts, region, value FROM readings WHERE metric = ?${regionSql} AND ts > ? ORDER BY ts, region`)
        .all(...args, cutoff) as HistoryPoint[];
    },
    daysWithData() {
      const rows = db.prepare('SELECT DISTINCT substr(ts,1,10) AS d FROM readings').all() as { d: string }[];
      return new Set(rows.map((x) => x.d));
    },
  };
}
