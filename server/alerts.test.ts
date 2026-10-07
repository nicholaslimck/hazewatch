import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from './db.ts';
import { level, isQuiet, alertText, decide, runAlerts, SendError } from './alerts.ts';
import { SCALES } from '../shared/scale.ts';
import { pm25ToAqi } from '../shared/aqi.ts';

const psi = SCALES.psi;
const aqi = SCALES.aqi;
const at = (hhmm: string) => Date.parse(`2026-10-06T${hhmm}:00+08:00`);
const sub = (notifiedLevel: number) => ({ chatId: 1, region: 'central' as const, scale: 'psi' as const, notifiedLevel });

test('level thresholds going up', () => {
  assert.equal(level(psi, 100, 0), 0);
  assert.equal(level(psi, 101, 0), 1);
  assert.equal(level(psi, 201, 1), 2);
  assert.equal(level(psi, 301, 0), 3);
});

test('level hysteresis going down', () => {
  assert.equal(level(psi, 96, 1), 1);
  assert.equal(level(psi, 95, 1), 0);
  assert.equal(level(psi, 196, 2), 2);
  assert.equal(level(psi, 195, 2), 1);
  assert.equal(level(psi, 296, 3), 3);
  assert.equal(level(psi, 295, 3), 2);
  assert.equal(level(psi, 150, 3), 1);
});

test('level thresholds and hysteresis on AQI', () => {
  // AQI alerts start at its own Unhealthy band (151), not the sensitive-groups band.
  assert.equal(level(aqi, 150, 0), 0);
  assert.equal(level(aqi, 151, 0), 1);
  assert.equal(level(aqi, 201, 1), 2);
  assert.equal(level(aqi, 301, 0), 3);
  assert.equal(level(aqi, 146, 1), 1); // 145 is the step-down point: edge 150 minus the 5-point gap
  assert.equal(level(aqi, 145, 1), 0);
  assert.equal(level(aqi, 196, 2), 2);
  assert.equal(level(aqi, 195, 2), 1);
});

test('isQuiet in SGT', () => {
  assert.equal(isQuiet(at('22:59')), false);
  assert.equal(isQuiet(at('23:00')), true);
  assert.equal(isQuiet(at('06:59')), true);
  assert.equal(isQuiet(at('07:00')), false);
});

test('alertText copy', () => {
  assert.equal(alertText(psi, 'central', 0, 1, 135), 'Central is now unhealthy (PSI 135). Skip the long run today.');
  assert.equal(alertText(psi, 'central', 2, 1, 190), 'Central has eased to unhealthy (PSI 190). Keep outdoor exercise light.');
  assert.equal(alertText(psi, 'central', 1, 0, 92), 'Central has cleared (PSI 92). Fine for a run.');
  assert.match(alertText(psi, 'central', 1, 2, 250), /is now very unhealthy/);
  assert.match(alertText(psi, 'central', 2, 3, 310), /is now hazardous/);
});

test('alertText names the band on either scale', () => {
  assert.equal(alertText(aqi, 'central', 0, 1, 160), 'Central is now unhealthy (AQI 160). Skip the long run today.');
  assert.match(alertText(aqi, 'central', 1, 2, 240), /is now very unhealthy \(AQI 240\)/);
  assert.match(alertText(aqi, 'central', 2, 3, 320), /is now hazardous \(AQI 320\)/);
});

test('decide sends on change outside quiet hours', () => {
  const d = decide(sub(0), 135, at('12:00'), psi);
  assert.equal(d.message, alertText(psi, 'central', 0, 1, 135));
  assert.equal(d.notifiedLevel, 1);
  assert.equal(decide(sub(1), 150, at('12:00'), psi).message, null);
});

test('decide holds during quiet hours', () => {
  assert.deepEqual(decide(sub(0), 135, at('23:30'), psi), { message: null, notifiedLevel: 0 });
});

test('first tick after 7am sends the held change', () => {
  assert.equal(decide(sub(0), 135, at('06:59'), psi).message, null);
  assert.equal(decide(sub(0), 135, at('07:00'), psi).message, alertText(psi, 'central', 0, 1, 135));
});

test('a change that reverted overnight sends nothing', () => {
  assert.deepEqual(decide(sub(0), 80, at('07:00'), psi), { message: null, notifiedLevel: 0 });
});

const setup = (psiValue?: number) => {
  const db = openDb(':memory:');
  if (psiValue !== undefined) db.upsert([{ ts: '2026-10-06T12:00:00+08:00', region: 'central', metric: 'psi_twenty_four_hourly', value: psiValue }]);
  db.subscribe(1, 'central', 0);
  return db;
};

// Three hourly readings is enough for a NowCast, which is what the AQI scale reads.
const setupAqi = (pm25 = 60) => {
  const db = openDb(':memory:');
  for (let h = 0; h < 3; h++) db.upsert([{ ts: `2026-10-06T${10 + h}:00:00+08:00`, region: 'central', metric: 'pm25_one_hourly', value: pm25 }]);
  db.subscribe(1, 'central', 0, 'aqi');
  return db;
};

test('runAlerts sends and records', async () => {
  const db = setup(135);
  const calls: [number, string][] = [];
  const res = await runAlerts(db, async (c, t) => void calls.push([c, t]), at('12:00'));
  assert.deepEqual(res, { sent: 1, dropped: 0 });
  assert.deepEqual(calls, [[1, alertText(psi, 'central', 0, 1, 135)]]);
  assert.equal(db.subscriptions()[0].notifiedLevel, 1);
});

test('runAlerts measures an AQI subscriber on AQI, not PSI', async () => {
  const db = setupAqi(60);
  const calls: [number, string][] = [];
  const res = await runAlerts(db, async (c, t) => void calls.push([c, t]), at('12:00'));
  assert.deepEqual(res, { sent: 1, dropped: 0 });
  const expected = alertText(aqi, 'central', 0, 1, pm25ToAqi(60));
  assert.deepEqual(calls, [[1, expected]]);
  assert.match(expected, /\(AQI \d+\)/);
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

test('runAlerts hands the card for the same reading to the send callback', async () => {
  const db = setup(135);
  const cards: unknown[] = [];
  await runAlerts(db, async (_c, _t, card) => void cards.push(card), at('12:00'));
  // Same rounded value the message quotes, and the ts the reading came from, so the image can't
  // disagree with the caption.
  assert.deepEqual(cards, [{ region: 'central', value: 135, ts: '2026-10-06T12:00:00+08:00', scale: 'psi' }]);
});

test('runAlerts cards an AQI subscriber in AQI', async () => {
  const db = setupAqi(60);
  const cards: unknown[] = [];
  await runAlerts(db, async (_c, _t, card) => void cards.push(card), at('12:00'));
  assert.deepEqual(cards, [{ region: 'central', value: pm25ToAqi(60), ts: '2026-10-06T12:00:00+08:00', scale: 'aqi' }]);
});
