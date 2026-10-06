import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from './db.ts';
import { ingestOnce, backfill, sgtDate, msUntilNext50, type Fetcher, type IngestState } from './ingest.ts';
import type { Reading } from '../shared/types.ts';

const r = (ts: string, metric: string, value = 1): Reading => ({ ts, region: 'north', metric, value });
const fresh = (): IngestState => ({ lastIngestAt: null, lastError: null });
const quiet = () => {
  const w = console.warn, l = console.log;
  console.warn = () => {}; console.log = () => {};
  return () => { console.warn = w; console.log = l; };
};

test('ingestOnce stores both endpoints', async () => {
  const store = openDb(':memory:');
  const f: Fetcher = async (e) => [r('2026-10-06T10:00:00+08:00', e === 'psi' ? 'psi_twenty_four_hourly' : 'pm25_one_hourly')];
  const s = fresh();
  await ingestOnce(store, f, s);
  assert.equal(store.count(), 2);
  assert.equal(s.lastError, null);
  assert.ok(s.lastIngestAt);
});

test('ingestOnce tolerates empty items', async () => {
  const store = openDb(':memory:');
  const s = fresh();
  const calls: string[] = [];
  const w = console.warn, e = console.error;
  console.warn = (...a) => { calls.push(`warn:${a.join(' ')}`); };
  console.error = (...a) => { calls.push(`error:${a.join(' ')}`); };
  try { await ingestOnce(store, async () => [], s); } finally { console.warn = w; console.error = e; }
  assert.deepEqual(calls, []);
  assert.equal(store.count(), 0);
  assert.equal(s.lastError, null);
  assert.ok(s.lastIngestAt);
});

test('ingestOnce partial failure', async () => {
  const store = openDb(':memory:');
  const f: Fetcher = async (e) => {
    if (e === 'psi') throw new Error('boom');
    return [r('2026-10-06T10:00:00+08:00', 'pm25_one_hourly')];
  };
  const s = fresh();
  const restore = quiet();
  try { await ingestOnce(store, f, s); } finally { restore(); }
  assert.equal(store.count(), 1);
  assert.match(s.lastError!, /psi/);
  assert.match(s.lastError!, /boom/);
  assert.equal(s.lastIngestAt, null);
});

test('backfill skips existing days', async () => {
  const store = openDb(':memory:');
  store.upsert([r('2026-10-05T12:00:00+08:00', 'pm25_one_hourly'), r('2026-10-05T12:00:00+08:00', 'psi_twenty_four_hourly')]);
  const calls: string[] = [];
  const f: Fetcher = async (e, d) => { calls.push(`${e}:${d}`); return [r(`${d}T12:00:00+08:00`, 'pm25_one_hourly')]; };
  const n = await backfill(store, f, { days: 3, todaySgt: '2026-10-06', sleepMs: 0 });
  assert.equal(n, 2);
  assert.deepEqual(calls, ['psi:2026-10-04', 'pm25:2026-10-04', 'psi:2026-10-06', 'pm25:2026-10-06']);
});

test('backfill continues past a failing day', async () => {
  const store = openDb(':memory:');
  const f: Fetcher = async (e, d) => {
    if (d === '2026-10-05') throw new Error('bad day');
    return [r(`${d}T12:00:00+08:00`, 'pm25_one_hourly')];
  };
  const restore = quiet();
  let n: number;
  try { n = await backfill(store, f, { days: 3, todaySgt: '2026-10-06', sleepMs: 0 }); } finally { restore(); }
  assert.equal(n, 2);
  assert.equal(store.daysWithData().has('2026-10-06'), true);
});

const metricOf = (e: string) => (e === 'psi' ? 'psi_twenty_four_hourly' : 'pm25_one_hourly');

test('backfill fetches the missing metric only', async () => {
  const store = openDb(':memory:');
  store.upsert([r('2026-10-05T12:00:00+08:00', 'pm25_one_hourly')]);
  const calls: string[] = [];
  const f: Fetcher = async (e, d) => { calls.push(`${e}:${d}`); return [r(`${d}T12:00:00+08:00`, metricOf(e))]; };
  await backfill(store, f, { days: 2, todaySgt: '2026-10-06', sleepMs: 0 });
  assert.ok(calls.includes('psi:2026-10-05'));
  assert.ok(!calls.includes('pm25:2026-10-05'));
});

test('backfill always refetches today for both endpoints', async () => {
  const store = openDb(':memory:');
  store.upsert([r('2026-10-06T01:00:00+08:00', 'pm25_one_hourly'), r('2026-10-06T01:00:00+08:00', 'psi_twenty_four_hourly')]);
  const calls: string[] = [];
  const f: Fetcher = async (e, d) => { calls.push(`${e}:${d}`); return [r(`${d}T02:00:00+08:00`, metricOf(e))]; };
  const n = await backfill(store, f, { days: 1, todaySgt: '2026-10-06', sleepMs: 0 });
  assert.deepEqual(calls, ['psi:2026-10-06', 'pm25:2026-10-06']);
  assert.equal(n, 1);
});

test('sgtDate', () => {
  assert.equal(sgtDate(Date.parse('2026-10-05T17:00:00Z')), '2026-10-06');
  assert.equal(sgtDate(Date.parse('2026-10-05T15:59:00Z')), '2026-10-05');
});

test('msUntilNext50', () => {
  assert.equal(msUntilNext50(Date.parse('2026-10-06T10:49:00Z')), 60_000);
  assert.equal(msUntilNext50(Date.parse('2026-10-06T10:50:00Z')), 3_600_000);
  assert.equal(msUntilNext50(Date.parse('2026-10-06T10:51:00Z')), 3_540_000);
});

test('ingestOnce fetches today (SGT) for each endpoint', async () => {
  const store = openDb(':memory:');
  const calls: string[] = [];
  const f: Fetcher = async (e, d) => { calls.push(`${e}:${d}`); return []; };
  await ingestOnce(store, f, fresh());
  const today = sgtDate(Date.now());
  assert.deepEqual(calls, [`psi:${today}`, `pm25:${today}`]);
});
