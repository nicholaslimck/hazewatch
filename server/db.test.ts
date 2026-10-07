import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from './db.ts';
import type { Reading } from '../shared/types.ts';

const r = (ts: string, value: number, metric = 'psi_twenty_four_hourly', region: Reading['region'] = 'central'): Reading => ({ ts, region, metric, value });
const hour = (d: string, h: number) => `${d}T${String(h).padStart(2, '0')}:00:00+08:00`;

test('upsert is idempotent', () => {
  const db = openDb(':memory:');
  const rs = Array.from({ length: 10 }, (_, i) => r(hour('2026-10-05', i), i));
  db.upsert(rs);
  db.upsert(rs);
  assert.equal(db.count(), 10);
  db.upsert([r(hour('2026-10-05', 0), 99)]);
  assert.equal(db.count(), 10);
  assert.equal(db.history('24h', 'psi_twenty_four_hourly')[0].value, 99);
});

test('now uses latest per metric', () => {
  const db = openDb(':memory:');
  db.upsert([r(hour('2026-10-05', 18), 55), r(hour('2026-10-05', 20), 12, 'pm25_one_hourly')]);
  const n = db.now();
  assert.deepEqual(n.regions.central, { psi_twenty_four_hourly: 55, pm25_one_hourly: 12 });
  assert.equal(n.ts, hour('2026-10-05', 20));
});

test('now adds pm25_nowcast per region from hourly PM2.5', () => {
  const db = openDb(':memory:');
  const rs: Reading[] = [];
  for (let h = 0; h < 12; h++) rs.push(r(hour('2026-10-05', 8 + h), 20, 'pm25_one_hourly'), r(hour('2026-10-05', 8 + h), 40, 'pm25_one_hourly', 'north'));
  rs.push(r(hour('2026-10-05', 19), 30, 'pm25_one_hourly', 'west')); // 1 hour only: no NowCast
  db.upsert(rs);
  const n = db.now();
  assert.equal(n.regions.central?.pm25_nowcast, 20);
  assert.equal(n.regions.north?.pm25_nowcast, 40);
  assert.equal(n.regions.west?.pm25_nowcast, undefined);
});

test('pm25_nowcast leans on recent hours when air changes fast, and ignores data older than 12 hours', () => {
  const db = openDb(':memory:');
  const rs: Reading[] = [r(hour('2026-10-04', 1), 500, 'pm25_one_hourly')]; // too old to count
  for (let h = 8; h < 19; h++) rs.push(r(hour('2026-10-05', h), 10, 'pm25_one_hourly'));
  rs.push(r(hour('2026-10-05', 19), 100, 'pm25_one_hourly'));
  db.upsert(rs);
  const nc = db.now().regions.central!.pm25_nowcast;
  assert.ok(nc > 50 && nc < 60, String(nc));
});

test('ageMinutes and empty db', () => {
  const db = openDb(':memory:');
  assert.deepEqual(db.now(), { ts: null, ageMinutes: null, regions: {} });
  db.upsert([r(hour('2026-10-05', 20), 1)]);
  assert.equal(db.now(Date.parse('2026-10-05T21:30:00+08:00')).ageMinutes, 90);
});

test('history 24h filters by metric and region', () => {
  const db = openDb(':memory:');
  const rs: Reading[] = [];
  for (let h = 0; h < 24; h++) rs.push(r(hour('2026-10-04', h), h), r(hour('2026-10-05', h), 100 + h));
  rs.push(r(hour('2026-10-05', 5), 7, 'pm25_one_hourly'), r(hour('2026-10-05', 5), 8, 'psi_twenty_four_hourly', 'north'));
  db.upsert(rs);
  const h = db.history('24h', 'psi_twenty_four_hourly', 'central');
  assert.equal(h.length, 24);
  assert.equal(h[0].ts, hour('2026-10-05', 0));
  assert.ok(h.every((p) => p.region === 'central'));
  assert.equal(db.history('24h', 'psi_twenty_four_hourly').length, 25);
  assert.equal(db.history('7d', 'psi_twenty_four_hourly', 'central').length, 48);
  assert.deepEqual(openDb(':memory:').history('24h', 'x'), []);
});

test('history 90d returns daily mean per region', () => {
  const db = openDb(':memory:');
  db.upsert([r(hour('2026-10-05', 1), 10), r(hour('2026-10-05', 2), 20), r(hour('2026-01-01', 2), 99)]);
  assert.deepEqual(db.history('90d', 'psi_twenty_four_hourly'), [{ ts: '2026-10-05', region: 'central', value: 15 }]);
});

test('history 90d keeps one decimal in daily means', () => {
  const db = openDb(':memory:');
  db.upsert([r(hour('2026-10-05', 1), 9, 'pm25_one_hourly'), r(hour('2026-10-05', 2), 10, 'pm25_one_hourly'), r(hour('2026-10-05', 3), 10, 'pm25_one_hourly')]);
  assert.equal(db.history('90d', 'pm25_one_hourly')[0].value, 9.7);
});

test('completeDays counts only days with all 24 hours, per metric', () => {
  const db = openDb(':memory:');
  const day = (d: string, n: number, metric?: string) => Array.from({ length: n }, (_, h) => r(hour(d, h), 1, metric));
  db.upsert([...day('2026-10-04', 24), ...day('2026-10-05', 23), ...day('2026-10-05', 24, 'pm25_one_hourly')]);
  db.upsert([r(hour('2026-10-04', 5), 1, 'pm25_one_hourly', 'north')]); // other regions don't add hours
  assert.deepEqual(db.completeDays('psi_twenty_four_hourly'), new Set(['2026-10-04']));
  assert.deepEqual(db.completeDays('pm25_one_hourly'), new Set(['2026-10-05']));
  assert.deepEqual(db.completeDays('nope'), new Set());
});

test('subscribe upserts and keeps one row per chat', () => {
  const db = openDb(':memory:');
  db.subscribe(1, 'central', 0);
  db.subscribe(1, 'west', 2);
  assert.deepEqual(db.subscriptions(), [{ chatId: 1, region: 'west', notifiedLevel: 2 }]);
});

test('unsubscribe and setNotified', () => {
  const db = openDb(':memory:');
  db.subscribe(1, 'central', 0);
  db.subscribe(2, 'east', 0);
  db.setNotified(1, 3);
  db.unsubscribe(2);
  assert.deepEqual(db.subscriptions(), [{ chatId: 1, region: 'central', notifiedLevel: 3 }]);
});

test('subscriptionCount', () => {
  const db = openDb(':memory:');
  assert.equal(db.subscriptionCount(), 0);
  db.subscribe(1, 'central', 0);
  db.subscribe(2, 'east', 0);
  assert.equal(db.subscriptionCount(), 2);
});

test('repeated now() calls update ageMinutes without losing data', () => {
  const db = openDb(':memory:');
  db.upsert([r(hour('2026-10-05', 20), 1)]);
  const a = db.now(Date.parse('2026-10-05T21:00:00+08:00'));
  const b = db.now(Date.parse('2026-10-05T22:30:00+08:00'));
  assert.equal(a.ageMinutes, 60);
  assert.equal(b.ageMinutes, 150); // still live after the first call cached the payload
  assert.equal(a.ts, b.ts);
  assert.deepEqual(a.regions, b.regions);
});
