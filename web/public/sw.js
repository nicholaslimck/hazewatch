const CACHE = 'hazecheck';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Network first so a reading is never older than it has to be; the cache only answers when offline.
async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await caches.match(req);
    if (hit) return hit;
    throw err; // no cache entry: surface the network error, not an empty 200
  }
}

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
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
