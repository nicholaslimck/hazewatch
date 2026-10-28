const CACHE = 'hazewatch';

// Precache the shell so the first offline launch works; failures never block install.
self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE);
        const res = await fetch('/');
        await cache.put('/', res.clone());
        const html = await res.text();
        await cache.addAll([...new Set(Array.from(html.matchAll(/\/assets\/[^"']+/g), (m) => m[0]))].concat('/api/now'));
      } catch {}
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// A cached answer says so, so the page can tell a saved reading from a live one (X-From-Cache).
function marked(res) {
  const headers = new Headers(res.headers);
  headers.set('X-From-Cache', '1');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

// Network first so a reading is never older than it has to be; the cache only answers when offline.
async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      (await caches.open(CACHE)).put(req, res.clone()).catch(() => {});
      return res;
    }
    const hit = await caches.match(req);
    return hit ? marked(hit) : res;
  } catch (err) {
    const hit = await caches.match(req);
    if (hit) return marked(hit);
    if (req.mode === 'navigate') {
      const rootHit = await caches.match('/');
      if (rootHit) return rootHit;
    }
    throw err; // no cache entry: surface the network error, not an empty 200
  }
}

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(CACHE)).put(req, res.clone()).catch(() => {});
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // ponytail: no version constant; old hashed /assets/* files pile up in the cache (small per build). Add cleanup in activate if it grows.
  if (url.pathname.startsWith('/assets/')) e.respondWith(cacheFirst(req));
  else if (req.mode === 'navigate' || url.pathname.startsWith('/api/')) e.respondWith(networkFirst(req));
});
