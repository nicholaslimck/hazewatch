import { useEffect, useState } from 'react';
import type { Region } from '../shared/types.ts';

export type NowResponse = {
  ts: string | null;
  ageMinutes: number | null;
  regions: Partial<Record<Region, Record<string, number>>>;
};
export type HistoryPoint = { ts: string; region: Region; value: number };
export type Range = '24h' | '7d' | '90d';

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const getNow = () => getJson<NowResponse>('/api/now');

export async function getHistory(range: Range, metric: string, region: Region): Promise<HistoryPoint[]> {
  const q = new URLSearchParams({ range, metric, region });
  return (await getJson<{ points: HistoryPoint[] }>(`/api/history?${q}`)).points;
}

// Refetches when the query or `tick` changes. A failed fetch keeps the last good points
// for the same query; points from a different query are never returned. No region: no fetch, null.
export function useHistory(range: Range, metric: string, region: Region | null, tick: number): HistoryPoint[] | null {
  const key = `${range}|${metric}|${region}`;
  const [state, setState] = useState<{ key: string; points: HistoryPoint[] } | null>(null);
  useEffect(() => {
    if (region === null) return;
    let live = true;
    getHistory(range, metric, region)
      .then((points) => { if (live) setState({ key, points }); })
      .catch(() => {});
    return () => { live = false; };
  }, [key, tick]);
  return state !== null && state.key === key ? state.points : null;
}
