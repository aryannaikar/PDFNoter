const CACHE_NAME = 'pdf-study-reader-v1';

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/pdf.worker.min.mjs',
  '/icon-192.png',
  '/icon-512.png',
];

// Install: Cache core application shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up older cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Serve from cache when offline, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept non-GET or cross-origin requests
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // App Shell / Document navigation: Stale-while-revalidate with offline fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match('/') || caches.match(event.request);
        })
    );
    return;
  }

  // Static Assets (_next, pdf.worker, images): Cache first with network fallback
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse.status === 200 &&
            (url.pathname.startsWith('/_next/') || url.pathname.endsWith('.mjs') || url.pathname.endsWith('.png'))
          ) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Return nothing if resource can't be fetched offline
          return new Response('Offline resource not cached', { status: 503, statusText: 'Offline' });
        });
    })
  );
});
