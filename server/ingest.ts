import { fetchNea, withRetry } from './nea.ts';
import type { Store } from './db.ts';
import type { Reading } from '../shared/types.ts';

export type Fetcher = (endpoint: 'psi' | 'pm25', date?: string) => Promise<Reading[]>;
export type IngestState = { lastIngestAt: string | null; lastError: string | null };

export const BACKFILL_DAYS = 90;
const HOUR = 3_600_000;
const ENDPOINTS = ['psi', 'pm25'] as const;

export const neaFetcher: Fetcher = (e, d) => withRetry(() => fetchNea(e, d));

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** YYYY-MM-DD in UTC+8 (SGT has no DST). */
export const sgtDate = (ms: number): string => new Date(ms + 8 * HOUR).toISOString().slice(0, 10);

/** How often to poll NEA. NEA publishes each hour's reading ~15 min past the hour; the old hourly
 *  poll at :50 left the app sitting on the previous hour's reading for up to ~35 min of every hour. */
export const POLL_MINUTES = 15;

/** Ms until the next poll slot — quarter-hourly on the wall clock (:00 :15 :30 :45); in (0, interval]. */
export function msUntilNextSlot(nowMs: number, everyMinutes: number = POLL_MINUTES): number {
  const interval = everyMinutes * 60_000;
  const d = interval - (nowMs % interval);
  return d > 0 ? d : d + interval;
}

export async function ingestOnce(store: Store, fetcher: Fetcher, state: IngestState): Promise<void> {
  const errors: string[] = [];
  for (const e of ENDPOINTS) {
    try {
      store.upsert(await fetcher(e, sgtDate(Date.now())));
    } catch (err) {
      errors.push(`${e}: ${msg(err)}`);
    }
  }
  if (errors.length) {
    state.lastError = errors.join('; ');
    console.warn(`ingest failed: ${state.lastError}`);
  } else {
    state.lastIngestAt = new Date().toISOString();
    state.lastError = null;
  }
}

export async function backfill(
  store: Store,
  fetcher: Fetcher,
  opts: { days: number; todaySgt: string; sleepMs: number },
): Promise<number> {
  const have = { psi: store.completeDays('psi_twenty_four_hourly'), pm25: store.completeDays('pm25_one_hourly') };
  const end = Date.parse(`${opts.todaySgt}T00:00:00Z`);
  let fetched = 0;
  for (let i = opts.days - 1; i >= 0; i--) {
    const date = new Date(end - i * 24 * HOUR).toISOString().slice(0, 10);
    // Today is always refetched: the scheduled ingest may have stored only the latest hours.
    const todo = ENDPOINTS.filter((e) => date === opts.todaySgt || !have[e].has(date));
    if (!todo.length) continue;
    let ok = false, rows = 0;
    for (const e of todo) {
      try {
        const rs = await fetcher(e, date);
        store.upsert(rs);
        ok = true;
        rows += rs.length;
      } catch (err) {
        console.warn(`backfill ${date} ${e}: ${msg(err)}`);
      }
      if (opts.sleepMs) await new Promise((r) => setTimeout(r, opts.sleepMs));
    }
    if (ok && rows > 0) fetched++;
    else console.warn(`backfill ${date}: no data, skipped`);
  }
  return fetched;
}
