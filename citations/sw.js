/* Service worker for the Citation Rules app.
 *
 * Every path here is relative, so the same file works whether the app is
 * served from the Flask dashboard at /citations/ or from GitHub Pages at
 * /<repo>/citations/. The rule corpus is precached with the shell: the app is
 * useless without it, and it is the one thing a network failure would silently
 * blank the page over.
 */
const CACHE = 'citation-rules-v1';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'data/citation_rules.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Same-origin only: the font and icon CDNs are left to the browser, and a
  // cross-origin opaque response is not worth filling the cache with.
  if (new URL(req.url).origin !== location.origin) return;

  // The rule corpus changes when the app is redeployed, so go to the network
  // first and fall back to the precached copy offline.
  if (req.url.includes('citation_rules.json')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('index.html').then((c) => c || caches.match('./')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
