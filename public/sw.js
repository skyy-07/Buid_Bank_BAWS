// BAWS Offline Service Worker
// Cache name version
const CACHE_NAME = 'baws-offline-v1';

// Core app shell assets to precache (production build compatible)
const STATIC_ASSETS = [
  '/',
  '/index.html',
];

// Install Event: Precaches core shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Precaching app shell assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Precache partial fallback:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Cleanup stale caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Clearing old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Network-First with Cache Fallback for API and Stale-While-Revalidate for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests and WebSocket / hot-reload calls
  if (event.request.method !== 'GET') {
    return;
  }

  // Handle API requests (e.g., /api/borrowers/*, /api/bank/*)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // Clone and cache successful API responses for offline replay
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Network failed (device is offline), attempt to return cached API response
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) {
            console.log('[SW] Serving cached API response offline for:', url.pathname);
            return cachedResponse;
          }

          // Return graceful JSON offline fallback if nothing in cache
          return new Response(
            JSON.stringify({
              error: 'Offline',
              message: 'You are currently offline. Displaying local cached profile.',
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

  // Handle Static Assets & HTML navigation (Network first, fall back to cache)
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        // Fallback to root index.html for SPA client navigation
        if (event.request.mode === 'navigate') {
          const indexFallback = await caches.match('/index.html');
          if (indexFallback) return indexFallback;
        }
        return new Response('Offline: Network connection unavailable', {
          status: 503,
          statusText: 'Service Unavailable (Offline)',
        });
      })
  );
});
