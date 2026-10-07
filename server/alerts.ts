import type { Region } from '../shared/types.ts';
import type { CardInput } from '../shared/card.ts';
import type { Store, Sub } from './db.ts';
import { verdict } from '../shared/verdict.ts';
import { regionName } from '../shared/format.ts';

const LABELS = ['clear', 'unhealthy', 'very unhealthy', 'hazardous'];

export class SendError extends Error {
  status: number;
  constructor(status: number) {
    super(`send failed: ${status}`);
    this.status = status;
  }
}

// Up is immediate; down steps one level at a time while PSI is 5+ below that level's lower edge (100, 200, 300).
export function level(psi: number, previous: number): 0 | 1 | 2 | 3 {
  const band = psi > 300 ? 3 : psi > 200 ? 2 : psi > 100 ? 1 : 0;
  let l = previous;
  if (band >= l) return band;
  while (l > 0 && psi <= l * 100 - 5) l--;
  return l as 0 | 1 | 2 | 3;
}

// 23:00–07:00 SGT
export const isQuiet = (ms: number) => {
  const h = new Date(ms + 8 * 3600_000).getUTCHours();
  return h >= 23 || h < 7;
};

export function alertText(region: Region, from: number, to: number, psi: number): string {
  const what = to === 0 ? 'has cleared' : `${to > from ? 'is now' : 'has eased to'} ${LABELS[to]}`;
  return `${regionName(region)} ${what} (PSI ${Math.round(psi)}). ${verdict(psi)[1]}`;
}

export function decide(sub: Sub, psi: number, nowMs: number): { message: string | null; notifiedLevel: number } {
  const next = level(psi, sub.notifiedLevel);
  if (isQuiet(nowMs) || next === sub.notifiedLevel) return { message: null, notifiedLevel: sub.notifiedLevel };
  return { message: alertText(sub.region, sub.notifiedLevel, next, psi), notifiedLevel: next };
}

export async function runAlerts(
  store: Store,
  send: (chatId: number, text: string, card?: CardInput) => Promise<void>,
  nowMs: number,
): Promise<{ sent: number; dropped: number }> {
  const { ts, regions } = store.now(nowMs);
  let sent = 0;
  let dropped = 0;
  for (const sub of store.subscriptions()) {
    const psi = regions[sub.region]?.psi_twenty_four_hourly;
    if (psi === undefined) continue;
    const d = decide(sub, psi, nowMs);
    if (d.message === null) continue;
    // The card quotes the same rounded value the message does, so the two can't disagree.
    const card = ts === null ? undefined : { region: sub.region, value: Math.round(psi), ts };
    try {
      await send(sub.chatId, d.message, card);
      store.setNotified(sub.chatId, d.notifiedLevel);
      sent++;
    } catch (e) {
      if (e instanceof SendError && e.status === 403) {
        store.unsubscribe(sub.chatId);
        dropped++;
      } else console.warn('alert send failed', e instanceof SendError ? e.status : String(e)); // leave the level; the next tick retries
    }
  }
  return { sent, dropped };
}
