/* Service worker: precache the app shell so the game (and engine opponents)
 * work offline. Stale-while-revalidate, same-origin GETs only — model API
 * calls are never intercepted. */
const CACHE = 'realpolitik-v1';
const ASSETS = ['./', 'index.html', 'styles.css', 'manifest.webmanifest',
  'js/ui.js', 'js/game.js', 'js/rules.js', 'js/ai.js', 'js/llm.js', 'js/map.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k.startsWith('realpolitik-')).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(req);
    const net = fetch(req).then((res) => { if (res && res.status === 200) cache.put(req, res.clone()); return res; }).catch(() => cached);
    return cached || net;
  }));
});
