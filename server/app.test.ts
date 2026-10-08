import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { openDb } from './db.ts';
import { createApp, httpUrlOrNull } from './app.ts';
import { REGIONS } from '../shared/types.ts';
import type { IngestState } from './ingest.ts';

const mk = () => {
  const store = openDb(':memory:');
  const state: IngestState = { lastIngestAt: null, lastError: null };
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

test('static: sw.js is no-cache, manifest has its own type', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pwa-'));
  writeFileSync(join(dir, 'sw.js'), 'self');
  writeFileSync(join(dir, 'manifest.webmanifest'), '{}');
  const app = createApp(openDb(':memory:'), { lastIngestAt: null, lastError: null }, dir);
  const sw = await app.request('/sw.js');
  assert.equal(sw.status, 200);
  assert.equal(sw.headers.get('cache-control'), 'no-cache');
  const m = await app.request('/manifest.webmanifest');
  assert.equal(m.status, 200);
  assert.match(m.headers.get('content-type') ?? '', /application\/manifest\+json/);
});

test('GET /api/config returns publicUrl and botUrl', async () => {
  const { store, state } = mk();
  const configs = [
    { publicUrl: null, botUrl: null },
    { publicUrl: 'https://haze.example', botUrl: 'https://t.me/hazewatch_bot' },
  ];
  for (const config of configs) {
    const res = await createApp(store, state, undefined, config).request('/api/config');
    assert.deepEqual(await res.json(), config);
    assert.equal(res.headers.get('cache-control'), 'no-store');
  }
});

test('httpUrlOrNull keeps only absolute http(s) links', () => {
  assert.equal(httpUrlOrNull('https://t.me/hazewatch_bot'), 'https://t.me/hazewatch_bot');
  assert.equal(httpUrlOrNull('http://example.test/bot'), 'http://example.test/bot');
  for (const bad of [undefined, null, '', 't.me/hazewatch_bot', 'javascript:alert(1)', 'ftp://x/y', 'not a url'])
    assert.equal(httpUrlOrNull(bad), null, String(bad));
});
