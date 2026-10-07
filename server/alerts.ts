import type { Region } from '../shared/types.ts';
import type { ScaleSpec } from '../shared/scale.ts';
import { SCALES } from '../shared/scale.ts';
import type { CardInput } from '../shared/card.ts';
import type { Store, Sub } from './db.ts';
import { regionName } from '../shared/format.ts';

export class SendError extends Error {
  status: number;
  constructor(status: number) {
    super(`send failed: ${status}`);
    this.status = status;
  }
}

// Level = how many of the scale's alert edges the value has passed. Up is immediate; down steps one
// level at a time while the value sits 5+ below the edge it would drop under (PSI: 95, 195, 295).
export function level(spec: ScaleSpec, v: number, previous: number): number {
  const band = spec.alertEdges.filter((e) => v > e).length;
  let l = previous;
  if (band >= l) return band;
  while (l > 0 && v <= spec.alertEdges[l - 1] - 5) l--;
  return l;
}

// 23:00–07:00 SGT
export const isQuiet = (ms: number) => {
  const h = new Date(ms + 8 * 3600_000).getUTCHours();
  return h >= 23 || h < 7;
};

export function alertText(spec: ScaleSpec, region: Region, from: number, to: number, v: number): string {
  // The band's own label, so the wording stays right on either scale.
  const what = to === 0 ? 'has cleared' : `${to > from ? 'is now' : 'has eased to'} ${spec.band(v).label.toLowerCase()}`;
  return `${regionName(region)} ${what} (${spec.name} ${Math.round(v)}). ${spec.verdict(v)[1]}`;
}

export function decide(sub: Sub, v: number, nowMs: number, spec: ScaleSpec): { message: string | null; notifiedLevel: number } {
  const next = level(spec, v, sub.notifiedLevel);
  if (isQuiet(nowMs) || next === sub.notifiedLevel) return { message: null, notifiedLevel: sub.notifiedLevel };
  return { message: alertText(spec, sub.region, sub.notifiedLevel, next, v), notifiedLevel: next };
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
    // Every subscriber is measured on the scale they chose, off that scale's own reading.
    const spec = SCALES[sub.scale];
    const v = spec.value(regions[sub.region] ?? {});
    if (v === undefined) continue;
    const d = decide(sub, v, nowMs, spec);
    if (d.message === null) continue;
    // The card quotes the same rounded value the message does, so the two can't disagree.
    const card = ts === null ? undefined : { region: sub.region, value: Math.round(v), ts, scale: sub.scale };
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
