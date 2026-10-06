import { REGIONS } from './types.ts';
import type { Region } from './types.ts';

// From NEA regionMetadata labelLocation.
export const REGION_CENTRES: Record<Region, { lat: number; lng: number }> = {
  north: { lat: 1.41803, lng: 103.82 },
  south: { lat: 1.29587, lng: 103.82 },
  east: { lat: 1.35735, lng: 103.94 },
  west: { lat: 1.35735, lng: 103.7 },
  central: { lat: 1.35735, lng: 103.82 },
};

// Squared-degree distance is fine at Singapore's scale.
export function nearestRegion(lat: number, lng: number): Region {
  let best: Region = 'central';
  let bestD = Infinity;
  for (const r of REGIONS) {
    const c = REGION_CENTRES[r];
    const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2;
    if (d < bestD) { bestD = d; best = r; }
  }
  return best;
}

export function parseSavedRegion(raw: string | null): Region | null {
  return raw !== null && (REGIONS as readonly string[]).includes(raw) ? (raw as Region) : null;
}
