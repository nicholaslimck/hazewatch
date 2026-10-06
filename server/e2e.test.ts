import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openDb } from './db.ts';
import { createApp } from './app.ts';
import { ingestOnce, neaFetcher } from './ingest.ts';

test('fixture -> ingest -> /api/now', async () => {
  const body = readFileSync(new URL('./fixtures/psi.json', import.meta.url), 'utf8');
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(body)) as typeof fetch;
  try {
    const store = openDb(':memory:');
    const state = { lastIngestAt: null, lastError: null };
    await ingestOnce(store, neaFetcher, state);
    assert.equal(state.lastError, null);
    const j = await (await createApp(store, state).request('/api/now')).json();
    assert.equal(Object.keys(j.regions).length, 5);
    assert.equal(j.regions.central.psi_twenty_four_hourly, 122);
  } finally {
    globalThis.fetch = realFetch;
  }
});
