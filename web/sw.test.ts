import { test } from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Runs public/sw.js against a fake cache and network and returns its fetch handler.
function loadSw(network: (req: Request) => Promise<Response>, cached: Response | undefined) {
  const listeners: Record<string, (e: unknown) => void> = {};
  const self = { addEventListener: (t: string, fn: (e: unknown) => void) => { listeners[t] = fn; }, location: { origin: 'http://x' } };
  const caches = { match: async () => cached?.clone(), open: async () => ({ put: async () => {} }) };
  runInNewContext(readFileSync(new URL('./public/sw.js', import.meta.url), 'utf8'), { self, caches, fetch: network, Headers, Response, URL, location: self.location });
  return async (req: Request) => {
    let out: Promise<Response> | undefined;
    listeners.fetch({ request: req, respondWith: (p: Promise<Response>) => { out = p; } });
    return out!;
  };
}

const api = () => new Request('http://x/api/now');
const saved = () => new Response('{"ts":"t"}', { headers: { 'content-type': 'application/json' } });

test('sw: a live answer is unmarked', async () => {
  const res = await loadSw(async () => new Response('{}'), saved())(api());
  assert.equal(res.headers.has('X-From-Cache'), false);
});

test('sw: offline, the cached reading is marked', async () => {
  const res = await loadSw(async () => { throw new TypeError('offline'); }, saved())(api());
  assert.equal(res.headers.get('X-From-Cache'), '1');
  assert.equal(res.headers.get('content-type'), 'application/json');
  assert.equal(await res.text(), '{"ts":"t"}');
});

test('sw: server error, the cached reading is marked', async () => {
  const res = await loadSw(async () => new Response('', { status: 502 }), saved())(api());
  assert.equal(res.headers.get('X-From-Cache'), '1');
});

test('sw: server error and nothing cached passes the error through', async () => {
  const res = await loadSw(async () => new Response('', { status: 502 }), undefined)(api());
  assert.equal(res.status, 502);
});
