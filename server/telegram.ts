import { REGIONS } from '../shared/types.ts';
import type { Region } from '../shared/types.ts';
import { nearestRegion, parseSavedRegion } from '../shared/regions.ts';
import { fmtTime, regionName } from '../shared/format.ts';
import { shareFilename } from '../shared/card.ts';
import type { CardInput } from '../shared/card.ts';
import { SCALES } from '../shared/scale.ts';
import type { Scale, ScaleSpec } from '../shared/scale.ts';
import type { Store } from './db.ts';
import { level, SendError } from './alerts.ts';
import { renderCard } from './card.ts';

export type TgUpdate = {
  update_id: number;
  message?: { chat: { id: number }; text?: string; location?: { latitude: number; longitude: number } };
  callback_query?: { id: string; data?: string; message?: { chat: { id: number } } };
};
// sendCard carries the card's inputs, not its bytes: handleUpdate stays pure and the poll loop renders.
export type ApiCall =
  | { method: 'sendMessage' | 'answerCallbackQuery'; body: Record<string, unknown> }
  | { method: 'sendCard'; chatId: number; text: string; card: CardInput };

const MAX_SUBS = 500;
const REPLY_GAP_MS = 3000;
const BACKOFF = [5000, 30000, 60000];
const HELP = 'Send /start or /region to pick a region, /scale to switch between PSI and AQI, /now for the current reading, or /stop to unsubscribe.';
const FULL = 'HazeWatch is full right now. Try again later.';
// What Telegram shows when someone types "/". Keep in step with the switch in handleUpdate.
const COMMANDS = [
  { command: 'start', description: 'Pick the region to watch' },
  { command: 'now', description: 'Current reading, as a share card' },
  { command: 'scale', description: 'Switch between PSI and AQI' },
  { command: 'region', description: 'Change the region you watch' },
  { command: 'stop', description: 'Stop the alerts' },
];
const SCALE_KEYBOARD = { inline_keyboard: [[SCALES.psi, SCALES.aqi].map((s) => ({ text: s.name, callback_data: `scale:${s.name.toLowerCase()}` }))] };

export function nowText(store: Store, region: Region, spec: ScaleSpec): string {
  const { ts, regions } = store.now();
  const v = spec.value(regions[region] ?? {});
  if (v === undefined || ts === null) return `${regionName(region)} · no reading yet.`;
  return `${regionName(region)} · ${spec.name} ${Math.round(v)}, ${spec.band(v).label.toLowerCase()}. ${spec.verdict(v)[1]} Updated ${fmtTime(ts)}`;
}

// Null when there is nothing to draw yet; the card quotes the same rounded value as the message.
export function cardInput(store: Store, region: Region, scale: Scale): CardInput | null {
  const { ts, regions } = store.now();
  const v = SCALES[scale].value(regions[region] ?? {});
  if (ts === null || v === undefined) return null;
  return { scale, region, value: Math.round(v), ts };
}

const watchText = (region: Region, spec: ScaleSpec) =>
  `You'll get a message when ${regionName(region)}'s ${spec.name} turns unhealthy, changes band, or clears. Nothing between 11pm and 7am.`;

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
  const mine = () => store.subscriptions().find((s) => s.chatId === chatId);
  // The level the current reading already sits at, so subscribing or switching scale doesn't fire on the next tick.
  const anchor = (region: Region, scale: Scale) => level(SCALES[scale], SCALES[scale].value(store.now().regions[region] ?? {}) ?? 0, 0);

  const subscribe = (region: Region) => {
    if (store.subscriptionCount() >= MAX_SUBS && !mine()) return say(FULL);
    const scale = mine()?.scale ?? 'psi'; // swapping region keeps the scale you chose
    store.subscribe(chatId, region, anchor(region, scale), scale);
    say(`${nowText(store, region, SCALES[scale])}\n\n${watchText(region, SCALES[scale])}`, { reply_markup: { remove_keyboard: true } });
  };

  const setScale = (scale: Scale) => {
    const sub = mine();
    if (!sub) return say('Pick a region first with /start.');
    // Re-anchor: notified_level is stored in the old scale's units and means nothing in the new one.
    store.subscribe(chatId, sub.region, anchor(sub.region, scale), scale);
    say(`${nowText(store, sub.region, SCALES[scale])}\n\n${watchText(sub.region, SCALES[scale])}`);
  };

  if (q) {
    const data = q.data ?? '';
    if (data.startsWith('scale:')) {
      const scale = data.slice(6);
      scale === 'psi' || scale === 'aqi' ? setScale(scale) : say(HELP);
    } else if (data === 'region:nearest') {
      say('Share your location and I will pick the nearest region.', {
        reply_markup: { keyboard: [[{ text: 'Share my location', request_location: true }]], one_time_keyboard: true, resize_keyboard: true },
      });
    } else {
      const region = parseSavedRegion(data.startsWith('region:') ? data.slice(7) : '');
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
    case '/region':
      say('Which part of Singapore should I watch?', {
        reply_markup: {
          inline_keyboard: [
            ...REGIONS.map((r) => [{ text: regionName(r), callback_data: `region:${r}` }]),
            [{ text: 'Use the region nearest me', callback_data: 'region:nearest' }],
          ],
        },
      });
      break;
    case '/scale': {
      const arg = m.text!.split(/[\s@]/)[1]?.toLowerCase();
      arg === 'psi' || arg === 'aqi' ? setScale(arg) : say('Which scale?', { reply_markup: SCALE_KEYBOARD });
      break;
    }
    case '/now': {
      const sub = mine();
      if (!sub) {
        say('Pick a region first with /start.');
        break;
      }
      const text = nowText(store, sub.region, SCALES[sub.scale]);
      const card = cardInput(store, sub.region, sub.scale);
      if (card) out.push({ method: 'sendCard', chatId, text, card });
      else say(text);
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
  const redact = (e: unknown) => (e instanceof Error && e.cause ? `${e} (${e.cause})` : String(e)).replaceAll(o.token, '<token>');
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
  // Telegram takes photos as multipart, so this is the one call that bypasses api()'s JSON body.
  const photo = async (chatId: number, text: string, card: CardInput) => {
    const form = new FormData();
    form.set('chat_id', String(chatId));
    form.set('caption', text);
    form.set('photo', new Blob([renderCard(card) as unknown as BlobPart], { type: 'image/png' }), shareFilename(card.region, card.ts));
    const res = await f(`https://api.telegram.org/bot${o.token}/sendPhoto`, { method: 'POST', body: form });
    if (!res.ok) throw new SendError(res.status);
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
            const call = c.method === 'sendCard' ? photo(c.chatId, c.text, c.card) : api(c.method, c.body);
            await call.catch((e) => console.warn('telegram reply failed', redact(e)));
          }
        }
      } catch (e) {
        if (ctl.signal.aborted) return;
        console.warn('telegram poll failed', redact(e));
        await sleep(BACKOFF[Math.min(fails++, BACKOFF.length - 1)]);
      }
    }
  }

  // Telegram shows a '/' menu only for commands registered here. Re-registering on every start is
  // idempotent and repairs a list that was cleared, so it needs no state of its own.
  const registerCommands = () => api('setMyCommands', { commands: COMMANDS });

  return {
    start() {
      registerCommands().catch((e) => console.warn('telegram command registration failed', redact(e)));
      loop().catch((e) => console.warn('telegram loop crashed', redact(e)));
    },
    stop() {
      ctl.abort();
    },
    // Alerts pass the card, so the message arrives as the same image the site's share button makes.
    async send(chatId: number, text: string, card?: CardInput) {
      if (card) return photo(chatId, text, card);
      await api('sendMessage', { chat_id: chatId, text });
    },
  };
}
