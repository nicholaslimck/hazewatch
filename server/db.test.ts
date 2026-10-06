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

test('daysWithData', () => {
  const db = openDb(':memory:');
  db.upsert([r(hour('2026-10-04', 1), 1), r(hour('2026-10-05', 1), 1), r(hour('2026-10-05', 2), 1)]);
  assert.deepEqual(db.daysWithData(), new Set(['2026-10-04', '2026-10-05']));
});

test('daysWithData filters by metric', () => {
  const db = openDb(':memory:');
  db.upsert([r(hour('2026-10-04', 1), 1), r(hour('2026-10-05', 1), 1, 'pm25_one_hourly')]);
  assert.deepEqual(db.daysWithData('psi_twenty_four_hourly'), new Set(['2026-10-04']));
  assert.deepEqual(db.daysWithData('pm25_one_hourly'), new Set(['2026-10-05']));
  assert.deepEqual(db.daysWithData('nope'), new Set());
});
