// The slice of UI state a link can carry, and the read/write of it against a query string.
// Pure string in, string out — no DOM — so the node tests can reach it (like calendar.ts and map.ts).
import type { Region } from '../shared/types.ts';
import type { Scale } from '../shared/scale.ts';
import type { View } from './components/Sky.tsx';
import { parseSavedRegion } from '../shared/regions.ts';

export type UiState = { region: Region | null; view: View; scale: Scale };

// The defaults are named once: writeSearch omits a value that equals its default, so a link stays
// short (?region=west, not ?region=west&view=simple&scale=psi), and readState reads a missing param
// back as the default. Change a default here and old links still resolve.
export const DEFAULT_VIEW: View = 'simple';
export const DEFAULT_SCALE: Scale = 'psi';

const parseView = (v: string | null): View | null => (v === 'simple' || v === 'numbers' ? v : null);
const parseScale = (v: string | null): Scale | null => (v === 'psi' || v === 'aqi' ? v : null);

// Only known values survive, so a hand-edited or truncated link degrades to the defaults rather than
// breaking, and a param the app does not use is simply ignored.
export function readState(search: string): { region: Region | null; view: View | null; scale: Scale | null } {
  const p = new URLSearchParams(search);
  return {
    region: parseSavedRegion(p.get('region')),
    view: parseView(p.get('view')),
    scale: parseScale(p.get('scale')),
  };
}

// '' when every value is at its default, so a plain visit keeps a clean URL.
export function writeSearch(s: UiState): string {
  const p = new URLSearchParams();
  if (s.region !== null) p.set('region', s.region);
  if (s.view !== DEFAULT_VIEW) p.set('view', s.view);
  if (s.scale !== DEFAULT_SCALE) p.set('scale', s.scale);
  const q = p.toString();
  return q === '' ? '' : `?${q}`;
}

// The link that reproduces what the sender is looking at, for the share text and the address bar.
export function deepLink(base: string | null, s: UiState): string | null {
  return base === null ? null : `${base}${writeSearch(s)}`;
}
