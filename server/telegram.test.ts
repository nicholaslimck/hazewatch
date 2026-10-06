import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from './db.ts';
import type { Store } from './db.ts';
import { level, SendError } from './alerts.ts';
import { createBot, handleUpdate, nowText } from './telegram.ts';
import type { TgUpdate } from './telegram.ts';

const TS = '2026-10-06T16:00:00+08:00';
const seeded = (psi = 135): Store => {
  const s = openDb(':memory:');
  s.upsert([{ ts: TS, region: 'central', metric: 'psi_twenty_four_hourly', value: psi }]);
  return s;
};
const msg = (text: string, chat = 1): TgUpdate => ({ update_id: 1, message: { chat: { id: chat }, text } });
const cb = (data: string, chat = 1): TgUpdate => ({ update_id: 1, callback_query: { id: 'q', data, message: { chat: { id: chat } } } });
const run = (s: Store, u: TgUpdate, lastReply = new Map<number, number>(), nowMs = 1_000_000) => handleUpdate(u, { store: s, nowMs, lastReply });
const text = (calls: ReturnType<typeof run>) => calls.filter((c) => c.method === 'sendMessage').map((c) => String(c.body.text)).join('\n');

test('/start replies with a region keyboard', () => {
  const [c] = run(seeded(), msg('/start'));
  const kb = (c.body.reply_markup as { inline_keyboard: { callback_data: string; text: string }[][] }).inline_keyboard.flat();
  assert.deepEqual(kb.map((b) => b.callback_data), ['region:north', 'region:south', 'region:east', 'region:west', 'region:central', 'region:nearest']);
  assert.equal(kb[5].text, 'Use the region nearest me');
});

test('callback region:central subscribes', () => {
  const s = seeded(135);
  const calls = run(s, cb('region:central'));
  assert.deepEqual(s.subscriptions(), [{ chatId: 1, region: 'central', notifiedLevel: level(135, 0) }]);
  assert.ok(text(calls).includes(nowText(s, 'central')));
  assert.ok(text(calls).includes("You'll get a message when Central's 24h PSI turns unhealthy, changes band, or clears. Nothing between 11pm and 7am."));
  assert.ok(calls.some((c) => c.method === 'answerCallbackQuery'));
});

test('nowText formats reading and missing data', () => {
  assert.equal(nowText(seeded(135), 'central'), 'Central · PSI 135, unhealthy. Skip the long run today. Updated 4:00 pm');
  assert.equal(nowText(seeded(), 'north'), 'North · no reading yet.');
});

test('region:nearest asks for location', () => {
  const calls = run(seeded(), cb('region:nearest'));
  const kb = (calls.find((c) => c.method === 'sendMessage')!.body.reply_markup as { keyboard: { request_location?: boolean }[][] }).keyboard;
  assert.equal(kb[0][0].request_location, true);
});

test('a location message subscribes to the nearest region', () => {
  const s = seeded();
  run(s, { update_id: 1, message: { chat: { id: 1 }, location: { latitude: 1.42, longitude: 103.82 } } });
  assert.equal(s.subscriptions()[0].region, 'north');
});

test('/now without and with subscription', () => {
  const s = seeded();
  assert.ok(text(run(s, msg('/now'))).includes('/start'));
  s.subscribe(1, 'central', 1);
  assert.equal(text(run(s, msg('/now'))), nowText(s, 'central'));
});

test('/stop removes the subscription', () => {
  const s = seeded();
  s.subscribe(1, 'central', 1);
  run(s, msg('/stop'));
  assert.equal(s.subscriptionCount(), 0);
});

test('unknown text gets one-line help and is not echoed', () => {
  const t = text(run(seeded(), msg('banana-split')));
  assert.equal(t, 'Send /start to pick a region, /now for the current reading, or /stop to unsubscribe.');
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
  assert.ok(text(calls).includes(nowText(s, 'central')));
});

test('cap: 501st subscriber is refused', () => {
  const s = seeded();
  for (let i = 100; i < 600; i++) s.subscribe(i, 'central', 0);
  const calls = run(s, cb('region:central', 1));
  assert.ok(text(calls).includes('HazeCheck is full right now. Try again later.'));
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
