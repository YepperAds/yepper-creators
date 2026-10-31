const CACHE_NAME = 'yepper-pwa-v1';
const PRECACHE_URLS = [
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith('yepper-pwa-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function offlinePage() {
  return new Response(
    '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#102A43"><title>Offline · Yepper</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#f4f8fc;color:#102a43;font:16px/1.6 system-ui,sans-serif}.card{max-width:440px;padding:36px;border:1px solid #dce8f1;border-radius:24px;background:white;box-shadow:0 20px 60px #102a4315}h1{margin:0 0 10px;font-size:28px;line-height:1.15}p{margin:0;color:#53677a}button{margin-top:24px;padding:12px 18px;border:0;border-radius:999px;background:#126e9f;color:white;font:600 14px system-ui,sans-serif;cursor:pointer}</style><main class="card"><h1>You’re offline</h1><p>Yepper couldn’t reach the network. Check your connection and try again.</p><button onclick="location.reload()">Try again</button></main></html>',
    {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    },
  );
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Page and API requests always go to the network. Authenticated pages and
  // private API data are intentionally never stored in the service-worker cache.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => offlinePage()));
    return;
  }

  if (!url.pathname.startsWith('/icons/')) return;
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    }),
  );
});
