import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from './db.ts';
import { level, isQuiet, alertText, decide, runAlerts, SendError } from './alerts.ts';

const at = (hhmm: string) => Date.parse(`2026-10-06T${hhmm}:00+08:00`);
const sub = (notifiedLevel: number) => ({ chatId: 1, region: 'central' as const, notifiedLevel });

test('level thresholds going up', () => {
  assert.equal(level(100, 0), 0);
  assert.equal(level(101, 0), 1);
  assert.equal(level(201, 1), 2);
  assert.equal(level(301, 0), 3);
});

test('level hysteresis going down', () => {
  assert.equal(level(96, 1), 1);
  assert.equal(level(95, 1), 0);
  assert.equal(level(196, 2), 2);
  assert.equal(level(195, 2), 1);
  assert.equal(level(296, 3), 3);
  assert.equal(level(295, 3), 2);
  assert.equal(level(150, 3), 1);
});

test('isQuiet in SGT', () => {
  assert.equal(isQuiet(at('22:59')), false);
  assert.equal(isQuiet(at('23:00')), true);
  assert.equal(isQuiet(at('06:59')), true);
  assert.equal(isQuiet(at('07:00')), false);
});

test('alertText copy', () => {
  assert.equal(alertText('central', 0, 1, 135), 'Central is now unhealthy (PSI 135). Skip the long run today.');
  assert.equal(alertText('central', 2, 1, 190), 'Central has eased to unhealthy (PSI 190). Keep outdoor exercise light.');
  assert.equal(alertText('central', 1, 0, 92), 'Central has cleared (PSI 92). Fine for a run.');
  assert.match(alertText('central', 1, 2, 250), /is now very unhealthy/);
  assert.match(alertText('central', 2, 3, 310), /is now hazardous/);
});

test('decide sends on change outside quiet hours', () => {
  const d = decide(sub(0), 135, at('12:00'));
  assert.equal(d.message, alertText('central', 0, 1, 135));
  assert.equal(d.notifiedLevel, 1);
  assert.equal(decide(sub(1), 150, at('12:00')).message, null);
});

test('decide holds during quiet hours', () => {
  assert.deepEqual(decide(sub(0), 135, at('23:30')), { message: null, notifiedLevel: 0 });
});

test('first tick after 7am sends the held change', () => {
  assert.equal(decide(sub(0), 135, at('06:59')).message, null);
  assert.equal(decide(sub(0), 135, at('07:00')).message, alertText('central', 0, 1, 135));
});

test('a change that reverted overnight sends nothing', () => {
  assert.deepEqual(decide(sub(0), 80, at('07:00')), { message: null, notifiedLevel: 0 });
});

const setup = (psi?: number) => {
  const db = openDb(':memory:');
  if (psi !== undefined) db.upsert([{ ts: '2026-10-06T12:00:00+08:00', region: 'central', metric: 'psi_twenty_four_hourly', value: psi }]);
  db.subscribe(1, 'central', 0);
  return db;
};

test('runAlerts sends and records', async () => {
  const db = setup(135);
  const calls: [number, string][] = [];
  const res = await runAlerts(db, async (c, t) => void calls.push([c, t]), at('12:00'));
  assert.deepEqual(res, { sent: 1, dropped: 0 });
  assert.deepEqual(calls, [[1, alertText('central', 0, 1, 135)]]);
  assert.equal(db.subscriptions()[0].notifiedLevel, 1);
});

test('runAlerts keeps level on send failure', async () => {
  const db = setup(135);
  db.subscribe(2, 'central', 0);
  const calls: number[] = [];
  const res = await runAlerts(db, async (c) => {
    calls.push(c);
    if (c === 1) throw new SendError(500);
  }, at('12:00'));
  assert.deepEqual(res, { sent: 1, dropped: 0 });
  assert.deepEqual(calls, [1, 2]); // one failure doesn't stop the rest
  assert.deepEqual(db.subscriptions().map((s) => s.notifiedLevel), [0, 1]);
});

test('runAlerts logs non-403 failures without the request detail', async (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const db = setup(135);
  await runAlerts(db, async () => { throw new SendError(500); }, at('12:00'));
  assert.equal(warn.mock.callCount(), 1);
  assert.deepEqual(warn.mock.calls[0].arguments, ['alert send failed', 500]);
});

test('runAlerts drops a subscription on 403', async () => {
  const db = setup(135);
  const res = await runAlerts(db, async () => { throw new SendError(403); }, at('12:00'));
  assert.deepEqual(res, { sent: 0, dropped: 1 });
  assert.equal(db.subscriptionCount(), 0);
});

test('runAlerts skips regions with no PSI', async () => {
  const db = setup();
  let n = 0;
  const res = await runAlerts(db, async () => void n++, at('12:00'));
  assert.deepEqual(res, { sent: 0, dropped: 0 });
  assert.equal(n, 0);
});
