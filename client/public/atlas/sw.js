// Atlas SW v20251212b - Minimal service worker for PWA
const CACHE_VERSION = 'atlas-v2';

self.addEventListener('install', (event) => {
  console.log('[ATLAS-SW] Installing v20251212');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[ATLAS-SW] Activating');
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.filter(name => name !== CACHE_VERSION).map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Network-first strategy for API calls
  if (event.request.url.includes('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // Network-first with cache fallback for navigation
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/atlas') || caches.match('/');
      })
    );
    return;
  }
  
  // Network only for everything else
  event.respondWith(fetch(event.request));
});
