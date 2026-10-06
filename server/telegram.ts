import { REGIONS } from '../shared/types.ts';
import type { Region } from '../shared/types.ts';
import { nearestRegion, parseSavedRegion } from '../shared/regions.ts';
import { psiBand } from '../shared/bands.ts';
import { verdict } from '../shared/verdict.ts';
import { fmtTime, regionName } from '../web/format.ts';
import type { Store } from './db.ts';
import { level, SendError } from './alerts.ts';

export type TgUpdate = {
  update_id: number;
  message?: { chat: { id: number }; text?: string; location?: { latitude: number; longitude: number } };
  callback_query?: { id: string; data?: string; message?: { chat: { id: number } } };
};
export type ApiCall = { method: 'sendMessage' | 'answerCallbackQuery'; body: Record<string, unknown> };

const MAX_SUBS = 500;
const REPLY_GAP_MS = 3000;
const BACKOFF = [5000, 30000, 60000];
const HELP = 'Send /start to pick a region, /now for the current reading, or /stop to unsubscribe.';
const FULL = 'HazeCheck is full right now. Try again later.';

export function nowText(store: Store, region: Region): string {
  const { ts, regions } = store.now();
  const psi = regions[region]?.psi_twenty_four_hourly;
  if (psi === undefined || ts === null) return `${regionName(region)} · no reading yet.`;
  return `${regionName(region)} · PSI ${Math.round(psi)}, ${psiBand(psi).label.toLowerCase()}. ${verdict(psi)[1]} Updated ${fmtTime(ts)}`;
}

export function handleUpdate(update: TgUpdate, ctx: { store: Store; nowMs: number; lastReply: Map<number, number> }): ApiCall[] {
  const { store, nowMs, lastReply } = ctx;
  const q = update.callback_query;
  const chatId = update.message?.chat.id ?? q?.message?.chat.id;
  if (chatId === undefined) return [];

  const out: ApiCall[] = [];
  if (q) out.push({ method: 'answerCallbackQuery', body: { callback_query_id: q.id } }); // stops Telegram's spinner
  // Rate limit applies to typed messages only; taps on our own inline keyboard are exempt.
  if (!q) {
    if (nowMs - (lastReply.get(chatId) ?? -Infinity) < REPLY_GAP_MS) return out;
    lastReply.set(chatId, nowMs);
  }
  const say = (text: string, extra: Record<string, unknown> = {}) => out.push({ method: 'sendMessage', body: { chat_id: chatId, text, ...extra } });

  const subscribe = (region: Region) => {
    if (store.subscriptionCount() >= MAX_SUBS && !store.subscriptions().some((s) => s.chatId === chatId)) return say(FULL);
    // Start at the level the confirmation already shows, so the first tick doesn't repeat it.
    store.subscribe(chatId, region, level(store.now().regions[region]?.psi_twenty_four_hourly ?? 0, 0));
    say(
      `${nowText(store, region)}\n\nYou'll get a message when ${regionName(region)}'s 24h PSI turns unhealthy, changes band, or clears. Nothing between 11pm and 7am.`,
      { reply_markup: { remove_keyboard: true } },
    );
  };

  if (q) {
    const arg = q.data?.startsWith('region:') ? q.data.slice(7) : '';
    if (arg === 'nearest') {
      say('Share your location and I will pick the nearest region.', {
        reply_markup: { keyboard: [[{ text: 'Share my location', request_location: true }]], one_time_keyboard: true, resize_keyboard: true },
      });
    } else {
      const region = parseSavedRegion(arg);
      region ? subscribe(region) : say(HELP);
    }
    return out;
  }

  const m = update.message!;
  if (m.location) {
    subscribe(nearestRegion(m.location.latitude, m.location.longitude));
    return out;
  }
  switch (m.text?.split(/[\s@]/)[0]) {
    case '/start':
      say('Which part of Singapore should I watch?', {
        reply_markup: {
          inline_keyboard: [
            ...REGIONS.map((r) => [{ text: regionName(r), callback_data: `region:${r}` }]),
            [{ text: 'Use the region nearest me', callback_data: 'region:nearest' }],
          ],
        },
      });
      break;
    case '/now': {
      const sub = store.subscriptions().find((s) => s.chatId === chatId);
      say(sub ? nowText(store, sub.region) : 'Pick a region first with /start.');
      break;
    }
    case '/stop':
      store.unsubscribe(chatId);
      say('Unsubscribed. Send /start to subscribe again.');
      break;
    default:
      say(HELP);
  }
  return out;
}

export function createBot(o: { token: string; store: Store; fetch?: typeof fetch; sleep?: (ms: number) => Promise<void> }) {
  const f = o.fetch ?? fetch;
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const redact = (e: unknown) => String(e).replaceAll(o.token, '<token>');
  const api = async (method: string, body: unknown, signal?: AbortSignal) => {
    const res = await f(`https://api.telegram.org/bot${o.token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) throw new SendError(res.status);
    return res;
  };
  const lastReply = new Map<number, number>();
  const ctl = new AbortController();
  let offset = 0;

  async function loop() {
    let fails = 0;
    while (!ctl.signal.aborted) {
      try {
        const res = await api('getUpdates', { offset, timeout: 50, allowed_updates: ['message', 'callback_query'] }, ctl.signal);
        const { result } = (await res.json()) as { result: TgUpdate[] };
        fails = 0;
        for (const u of result) {
          offset = u.update_id + 1;
          for (const c of handleUpdate(u, { store: o.store, nowMs: Date.now(), lastReply })) {
            await api(c.method, c.body).catch((e) => console.warn('telegram reply failed', redact(e)));
          }
        }
      } catch (e) {
        if (ctl.signal.aborted) return;
        console.warn('telegram poll failed', redact(e));
        await sleep(BACKOFF[Math.min(fails++, BACKOFF.length - 1)]);
      }
    }
  }

  return {
    start() {
      loop().catch((e) => console.warn('telegram loop crashed', redact(e)));
    },
    stop() {
      ctl.abort();
    },
    async send(chatId: number, text: string) {
      await api('sendMessage', { chat_id: chatId, text });
    },
  };
}
