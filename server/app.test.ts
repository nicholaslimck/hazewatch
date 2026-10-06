import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { openDb } from './db.ts';
import { createApp } from './app.ts';
import { REGIONS } from '../shared/types.ts';

const mk = () => {
  const store = openDb(':memory:');
  const state = { lastIngestAt: null, lastError: null };
  return { store, state, app: createApp(store, state) };
};

test('startup on empty db', async () => {
  const { app } = mk();
  const now = await app.request('/api/now');
  assert.equal(now.status, 200);
  const j = await now.json();
  assert.equal(j.ts, null);
  assert.deepEqual(j.regions, {});
  const h = await app.request('/api/health');
  assert.deepEqual(await h.json(), { ok: true, lastIngestAt: null, lastError: null });
  assert.equal(h.headers.get('cache-control'), 'no-store');
});

test('health reports ingest error', async () => {
  const { app, state } = mk();
  state.lastError = 'boom';
  assert.equal((await (await app.request('/api/health')).json()).ok, false);
});

test('now returns all five regions', async () => {
  const { app, store } = mk();
  const ts = new Date().toISOString().slice(0, 19) + '+08:00';
  store.upsert(REGIONS.map((region, i) => ({ ts, region, metric: 'psi_twenty_four_hourly', value: 40 + i })));
  const j = await (await app.request('/api/now')).json();
  assert.deepEqual(Object.keys(j.regions).sort(), [...REGIONS].sort());
});

test('history validates params', async () => {
  const { app } = mk();
  const ok = await app.request('/api/history?range=24h&metric=psi_twenty_four_hourly');
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { points: [] });
  for (const q of ['range=1y&metric=psi', 'range=24h&region=mars&metric=psi', 'range=24h', 'range=24h&metric=a-b'])
    {
      const r = await app.request(`/api/history?${q}`);
      assert.equal(r.status, 400, q);
      assert.ok((await r.json()).error);
    }
});

test('cache header and json 404', async () => {
  const { app } = mk();
  assert.equal((await app.request('/api/now')).headers.get('cache-control'), 'max-age=300');
  const r = await app.request('/api/nope');
  assert.equal(r.status, 404);
  assert.ok((await r.json()).error);
});

test('static: html no-cache, missing assets 404, SPA fallback', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'spa-'));
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'index.html'), '<html>spa</html>');
  writeFileSync(join(dir, 'assets', 'a.js'), 'x=1');
  const store = openDb(':memory:');
  const app = createApp(store, { lastIngestAt: null, lastError: null }, dir);
  for (const p of ['/', '/some/route']) {
    const r = await app.request(p);
    assert.equal(r.status, 200, p);
    assert.equal(r.headers.get('cache-control'), 'no-cache', p);
    assert.match(await r.text(), /spa/);
  }
  assert.equal((await app.request('/assets/a.js')).status, 200);
  assert.equal((await app.request('/assets/missing.js')).status, 404);
  assert.equal((await app.request('/favicon.ico')).status, 404);
  const api = await app.request('/api/nope');
  assert.equal(api.status, 404);
  assert.deepEqual(await api.json(), { error: 'not found' });
  const esc = await app.request('/../package.json');
  assert.doesNotMatch(await esc.text(), /sg-air-quality-monitor/);
});
