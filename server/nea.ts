import { REGIONS } from '../shared/types.ts';
import type { Reading, Region } from '../shared/types.ts';

const BASE = 'https://api-open.data.gov.sg/v2/real-time/api';

export function parseNea(json: any): Reading[] {
  if (json?.code !== 0) throw new Error(`NEA error: ${json?.errorMsg}`);
  const out: Reading[] = [];
  for (const item of json.data?.items ?? []) {
    for (const [metric, byRegion] of Object.entries<any>(item.readings ?? {})) {
      for (const region of REGIONS) {
        const value = byRegion?.[region];
        if (typeof value === 'number' && Number.isFinite(value)) {
          out.push({ ts: item.timestamp, region: region as Region, metric, value });
        }
      }
    }
  }
  return out;
}

export async function fetchNea(
  endpoint: 'psi' | 'pm25',
  date?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Reading[]> {
  const key = process.env.DATA_GOV_SG_API_KEY;
  const res = await fetchImpl(`${BASE}/${endpoint}${date ? `?date=${date}` : ''}`, {
    headers: key ? { 'x-api-key': key } : {},
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`NEA ${endpoint} failed: HTTP ${res.status}`);
  return parseNea(await res.json());
}

export async function withRetry<T>(fn: () => Promise<T>, delaysMs = [5000, 20000]): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= delaysMs.length) throw e;
      await new Promise((r) => setTimeout(r, delaysMs[i]));
    }
  }
}
