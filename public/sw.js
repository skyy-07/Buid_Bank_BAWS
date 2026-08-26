// BAWS Offline Service Worker
const CACHE_NAME = 'baws-offline-v2';

// Critical app shell assets to precache
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.ico',
];

// Install Event: Precaches core shell assets safely
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Precache partial fallback:', err);
      });
    })
  );
});

// Activate Event: Cleanup stale caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Only intercept GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // 2. CRITICAL: Never intercept cross-origin requests (Firebase Auth, Firestore, Google APIs, CDNs, etc.)
  if (url.origin !== self.location.origin) {
    return;
  }

  // 3. Never intercept Vite dev server, HMR, WebSocket, or streaming connections
  if (
    url.pathname.includes('/@vite/') ||
    url.pathname.includes('/@fs/') ||
    url.pathname.includes('/__vite') ||
    url.pathname.includes('node_modules') ||
    url.pathname.includes('/Listen/channel') ||
    event.request.headers.get('accept')?.includes('text/event-stream')
  ) {
    return;
  }

  // 4. Handle same-origin API requests (/api/*)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            try {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone).catch(() => {});
              });
            } catch {}
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) {
            return cachedResponse;
          }
          return new Response(
            JSON.stringify({
              error: 'Offline',
              message: 'Operating in offline local cache mode.',
              isOfflineFallback: true,
            }),
            {
              headers: { 'Content-Type': 'application/json' },
              status: 200,
            }
          );
        })
    );
    return;
  }

  // 5. Handle static assets (Network First with Cache Fallback)
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && event.request.url.startsWith('http')) {
          try {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone).catch(() => {});
            });
          } catch {}
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        if (event.request.mode === 'navigate') {
          const indexFallback = await caches.match('/index.html');
          if (indexFallback) return indexFallback;
        }
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      })
  );
});
