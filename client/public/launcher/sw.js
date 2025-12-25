const CACHE_VERSION = 'p3-v19-20251129-atlas-nuke';
const STATIC_CACHE = `p3-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `p3-dynamic-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest-app.json',
  '/manifest-launcher.json',
  '/icons/owl-192.svg',
  '/icons/owl-512.svg',
  '/icons/owl-maskable.svg',
  '/icons/p3-192.svg',
  '/icons/p3-512.svg',
  '/icons/p3-maskable.svg',
  '/icons/p3-hub-192.svg',
  '/icons/p3-hub-512.svg',
  '/icons/launcher-192.svg',
  '/icons/launcher-512.svg'
];

const API_CACHE_MAX_AGE = 5 * 60 * 1000;

self.addEventListener('install', (event) => {
  console.log('[SW-LAUNCHER-NUCLEAR] Installing:', CACHE_VERSION);
  // NUCLEAR: Delete ALL caches first
  event.waitUntil(
    caches.keys().then((names) => {
      console.log('[SW-LAUNCHER-NUCLEAR] Purging ALL caches:', names.length);
      return Promise.all(names.map((name) => caches.delete(name)));
    }).then(() => {
      return caches.open(STATIC_CACHE).then((cache) => {
        console.log('[SW-LAUNCHER-NUCLEAR] Fresh cache created');
        return cache.addAll(STATIC_ASSETS).catch((err) => {
          console.warn('[SW-LAUNCHER-NUCLEAR] Some assets failed:', err);
        });
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW-LAUNCHER-NUCLEAR] Activating:', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => {
            console.log('[SW-LAUNCHER-NUCLEAR] Deleting:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'CACHE_CLEARED', version: CACHE_VERSION });
        });
      });
    })
  );
  self.clients.claim();
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // NETWORK-FIRST for JS/CSS - always get fresh code
  if (url.pathname.match(/\.(js|css)$/)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Cache-first only for images/fonts
  if (url.pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|eot|ico)$/)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirst(request));
});

function isStaticAsset(pathname) {
  return /\.(svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|eot|ico)$/.test(pathname);
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.warn('[SW-Launcher] Cache-first fetch failed:', error);
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    if (request.mode === 'navigate') {
      const fallback = await caches.match('/index.html');
      if (fallback) return fallback;
    }
    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch((error) => {
      console.warn('[SW-Launcher] Stale-while-revalidate fetch failed:', error);
      return null;
    });

  if (cached) {
    fetchPromise;
    return cached;
  }

  const networkResponse = await fetchPromise;
  if (networkResponse) {
    return networkResponse;
  }

  return new Response(JSON.stringify({ error: 'Offline' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
