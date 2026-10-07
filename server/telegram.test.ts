import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from './db.ts';
import type { Store } from './db.ts';
import { level, SendError } from './alerts.ts';
import { createBot, handleUpdate, nowText } from './telegram.ts';
import type { TgUpdate } from './telegram.ts';
import { SCALES } from '../shared/scale.ts';
import { pm25ToAqi } from '../shared/aqi.ts';

const TS = '2026-10-06T16:00:00+08:00';
const seeded = (psi = 135): Store => {
  const s = openDb(':memory:');
  s.upsert([{ ts: TS, region: 'central', metric: 'psi_twenty_four_hourly', value: psi }]);
  return s;
};
// Three hourly readings is enough for a NowCast, which is what the AQI scale reads.
const seededAqi = (pm25 = 60): Store => {
  const s = openDb(':memory:');
  for (let h = 0; h < 3; h++) s.upsert([{ ts: `2026-10-06T${14 + h}:00:00+08:00`, region: 'central', metric: 'pm25_one_hourly', value: pm25 }]);
  return s;
};
const msg = (text: string, chat = 1): TgUpdate => ({ update_id: 1, message: { chat: { id: chat }, text } });
const cb = (data: string, chat = 1): TgUpdate => ({ update_id: 1, callback_query: { id: 'q', data, message: { chat: { id: chat } } } });
const run = (s: Store, u: TgUpdate, lastReply = new Map<number, number>(), nowMs = 1_000_000) => handleUpdate(u, { store: s, nowMs, lastReply });
type Call = ReturnType<typeof run>[number];
// Two shapes: a message (has a body) and a card. Narrow on method, then the fields stay typed.
type BodyCall = Extract<Call, { body: unknown }>;
type CardCall = Extract<Call, { method: 'sendCard' }>;
const msgs = (calls: Call[]) => calls.filter((c) => c.method === 'sendMessage') as BodyCall[];
const cards = (calls: Call[]) => calls.filter((c) => c.method === 'sendCard') as CardCall[];
const text = (calls: Call[]) => msgs(calls).map((c) => String(c.body.text)).join('\n');
const keyboard = (calls: Call[]) => (msgs(calls)[0].body.reply_markup as { inline_keyboard: { callback_data: string; text: string }[][] }).inline_keyboard.flat();

test('/start replies with a region keyboard', () => {
  const kb = keyboard(run(seeded(), msg('/start')));
  assert.deepEqual(kb.map((b) => b.callback_data), ['region:north', 'region:south', 'region:east', 'region:west', 'region:central', 'region:nearest']);
  assert.equal(kb[5].text, 'Use the region nearest me');
});

test('/region shows the same keyboard as /start', () => {
  assert.deepEqual(run(seeded(), msg('/region')), run(seeded(), msg('/start')));
});

test('callback region:central subscribes', () => {
  const s = seeded(135);
  const calls = run(s, cb('region:central'));
  assert.deepEqual(s.subscriptions(), [{ chatId: 1, region: 'central', scale: 'psi', notifiedLevel: level(SCALES.psi, 135, 0) }]);
  assert.ok(text(calls).includes(nowText(s, 'central', SCALES.psi)));
  assert.ok(text(calls).includes("You'll get a message when Central's PSI turns unhealthy, changes band, or clears. Nothing between 11pm and 7am."));
  assert.ok(calls.some((c) => c.method === 'answerCallbackQuery'));
});

test('nowText formats reading and missing data', () => {
  assert.equal(nowText(seeded(135), 'central', SCALES.psi), 'Central · PSI 135, unhealthy. Skip the long run today. Updated 4:00 pm');
  assert.equal(nowText(seeded(), 'north', SCALES.psi), 'North · no reading yet.');
});

test('nowText reads whichever scale it is given', () => {
  assert.equal(nowText(seededAqi(60), 'central', SCALES.aqi), `Central · AQI ${pm25ToAqi(60)}, unhealthy. Skip the long run today. Updated 4:00 pm`);
  assert.equal(nowText(seededAqi(60), 'central', SCALES.psi), 'Central · no reading yet.'); // no PSI in that store
});

test('region:nearest asks for location', () => {
  const calls = run(seeded(), cb('region:nearest'));
  const kb = (msgs(calls)[0].body.reply_markup as { keyboard: { request_location?: boolean }[][] }).keyboard;
  assert.equal(kb[0][0].request_location, true);
});

test('a location message subscribes to the nearest region', () => {
  const s = seeded();
  run(s, { update_id: 1, message: { chat: { id: 1 }, location: { latitude: 1.42, longitude: 103.82 } } });
  assert.equal(s.subscriptions()[0].region, 'north');
});

test('/scale with no argument offers both scales', () => {
  const kb = keyboard(run(seeded(), msg('/scale')));
  assert.deepEqual(kb.map((b) => b.callback_data), ['scale:psi', 'scale:aqi']);
  assert.deepEqual(kb.map((b) => b.text), ['PSI', 'AQI']);
});

test('/scale rejects an unknown scale and re-offers the keyboard', () => {
  assert.deepEqual(keyboard(run(seeded(), msg('/scale celsius'))).map((b) => b.callback_data), ['scale:psi', 'scale:aqi']);
});

test('/scale before subscribing asks for a region', () => {
  assert.equal(text(run(seeded(), msg('/scale aqi'))), 'Pick a region first with /start.');
});

test('/scale aqi switches the subscription and re-anchors the level', () => {
  const s = seededAqi(60);
  s.subscribe(1, 'central', 0);
  const calls = run(s, msg('/scale aqi'));
  const sub = s.subscriptions()[0];
  assert.equal(sub.scale, 'aqi');
  assert.equal(sub.region, 'central'); // the region is untouched
  // Re-anchored to today's AQI, so the switch itself doesn't fire an alert on the next tick.
  assert.equal(sub.notifiedLevel, level(SCALES.aqi, pm25ToAqi(60), 0));
  assert.ok(text(calls).includes(nowText(s, 'central', SCALES.aqi)));
  assert.ok(text(calls).includes("You'll get a message when Central's AQI turns unhealthy"));
});

test('the scale callback switches too', () => {
  const s = seededAqi();
  s.subscribe(1, 'central', 0);
  run(s, cb('scale:aqi'));
  assert.equal(s.subscriptions()[0].scale, 'aqi');
});

test('an unknown scale callback is rejected', () => {
  const s = seeded();
  s.subscribe(1, 'central', 0);
  assert.ok(text(run(s, cb('scale:celsius', 2))).startsWith('Send /start'));
  assert.equal(s.subscriptions()[0].scale, 'psi');
});

test('changing region keeps the scale you chose', () => {
  const s = seededAqi();
  s.subscribe(1, 'central', 1, 'aqi');
  run(s, cb('region:east'));
  assert.equal(s.subscriptions()[0].region, 'east');
  assert.equal(s.subscriptions()[0].scale, 'aqi');
});

test('/now without a subscription asks for a region', () => {
  assert.ok(text(run(seeded(), msg('/now'))).includes('/start'));
});

test('/now with a subscription sends the card captioned with the reading', () => {
  const s = seeded();
  s.subscribe(1, 'central', 1);
  const [call] = cards(run(s, msg('/now')));
  assert.equal(call.text, nowText(s, 'central', SCALES.psi));
  assert.deepEqual(call.card, { scale: 'psi', region: 'central', value: 135, ts: TS });
});

test('/now sends an AQI subscriber the AQI card', () => {
  const s = seededAqi(60);
  s.subscribe(1, 'central', 1, 'aqi');
  const [call] = cards(run(s, msg('/now')));
  assert.deepEqual(call.card, { scale: 'aqi', region: 'central', value: pm25ToAqi(60), ts: TS });
  assert.match(call.text, /\(AQI \d+\)|AQI \d+/);
});

test('/now falls back to text when there is nothing to draw', () => {
  const s = seeded(); // only central has a reading
  s.subscribe(1, 'east', 0);
  const calls = run(s, msg('/now'));
  assert.equal(cards(calls).length, 0);
  assert.equal(text(calls), nowText(s, 'east', SCALES.psi));
});

test('/stop removes the subscription', () => {
  const s = seeded();
  s.subscribe(1, 'central', 1);
  run(s, msg('/stop'));
  assert.equal(s.subscriptionCount(), 0);
});

test('unknown text gets one-line help and is not echoed', () => {
  const t = text(run(seeded(), msg('banana-split')));
  assert.equal(t, 'Send /start or /region to pick a region, /scale to switch between PSI and AQI, /now for the current reading, or /stop to unsubscribe.');
});

test('callback with unknown region is rejected', () => {
  const s = seeded();
  for (const d of ['region:../x', 'region:']) {
    assert.ok(text(run(s, cb(d, 2))).startsWith('Send /start'));
  }
  assert.equal(s.subscriptionCount(), 0);
});

test('rate limit drops a second reply within 3 s', () => {
  const s = seeded();
  const last = new Map<number, number>();
  assert.equal(run(s, msg('/now'), last, 10_000).length, 1);
  assert.equal(run(s, msg('/now'), last, 12_000).length, 0);
  assert.equal(run(s, msg('/now'), last, 13_000).length, 1);
});

test('a tap right after /start is not rate limited', () => {
  const s = seeded();
  const last = new Map<number, number>();
  run(s, msg('/start'), last, 10_000);
  const calls = run(s, cb('region:central'), last, 10_000);
  assert.deepEqual(s.subscriptions().map((x) => x.region), ['central']);
  assert.ok(text(calls).includes(nowText(s, 'central', SCALES.psi)));
});

test('cap: 501st subscriber is refused', () => {
  const s = seeded();
  for (let i = 100; i < 600; i++) s.subscribe(i, 'central', 0);
  const calls = run(s, cb('region:central', 1));
  assert.ok(text(calls).includes('HazeWatch is full right now. Try again later.'));
  assert.equal(s.subscriptionCount(), 500);
});

const resp = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body }) as Response;
const never = (signal?: AbortSignal | null) => new Promise<Response>((_, rej) => signal?.addEventListener('abort', () => rej(new Error('aborted'))));

test('poll loop survives fetch errors', async () => {
  const s = seeded();
  const TOKEN = 'SECRET:TOKEN';
  let polls = 0;
  const sent: unknown[] = [];
  let done!: () => void;
  const handled = new Promise<void>((r) => (done = r));
  const sleeps: number[] = [];
  const warns: string[] = [];
  const warn = console.warn;
  console.warn = (...a: unknown[]) => void warns.push(a.join(' '));
  const fetchStub = (async (url: string, init?: RequestInit) => {
    if (url.endsWith('/getUpdates')) {
      polls++;
      if (polls <= 2) throw new Error(`connect failed ${url}`);
      if (polls === 3) return resp({ ok: true, result: [msg('/stop')] });
      return never(init?.signal);
    }
    sent.push(JSON.parse(String(init?.body)));
    if (url.endsWith('/sendMessage')) done();
    return resp({ ok: true });
  }) as unknown as typeof fetch;
  try {
    const bot = createBot({ token: TOKEN, store: s, fetch: fetchStub, sleep: async (ms) => void sleeps.push(ms) });
    bot.start();
    await handled;
    bot.stop();
  } finally {
    console.warn = warn;
  }
  assert.deepEqual(sleeps, [5000, 30000]);
  assert.equal(warns.length, 2);
  assert.ok(warns.every((w) => !w.includes(TOKEN)));
});

test('send throws SendError with status', async () => {
  const bot = createBot({ token: 't', store: seeded(), fetch: (async () => resp({}, false, 403)) as unknown as typeof fetch });
  await assert.rejects(bot.send(1, 'x'), (e: unknown) => e instanceof SendError && e.status === 403);
});

test('send posts a card as multipart sendPhoto with the reading as the caption', async () => {
  let seen: { url: string; body: unknown } | null = null;
  const fetchStub = (async (url: string, init?: RequestInit) => {
    seen = { url, body: init?.body };
    return resp({ ok: true });
  }) as unknown as typeof fetch;
  const bot = createBot({ token: 't', store: seeded(), fetch: fetchStub });
  await bot.send(7, 'Central is now unhealthy (PSI 135). Skip the long run today.', { scale: 'psi', region: 'central', value: 135, ts: TS });
  assert.ok(seen!.url.endsWith('/sendPhoto'));
  const form = seen!.body as FormData;
  assert.equal(form.get('chat_id'), '7');
  assert.equal(form.get('caption'), 'Central is now unhealthy (PSI 135). Skip the long run today.');
  const photo = form.get('photo') as File;
  assert.equal(photo.type, 'image/png');
  assert.equal(photo.name, 'hazewatch-central-2026-10-06.png');
  assert.ok(photo.size > 1000, 'the card has actual bytes');
});
