const CACHE_NAME = 'atlas-push-v20251212';
const SHELL_ASSETS = [
  '/manifest-app.json',
  '/manifest-launcher.json',
  '/icons/owl-192.svg',
  '/icons/owl-512.svg',
  '/icons/owl-maskable.svg',
  '/icons/p3-192.svg',
  '/icons/p3-512.svg',
  '/icons/p3-maskable.svg'
];

self.addEventListener('install', (event) => {
  console.log('[PushSW] Installing:', CACHE_NAME);
  event.waitUntil(
    caches.keys().then((names) => {
      console.log('[PushSW] Purging old caches:', names.length);
      return Promise.all(names.map((name) => caches.delete(name)));
    }).then(() => {
      return caches.open(CACHE_NAME).then((cache) => {
        console.log('[PushSW] Fresh cache created');
        return cache.addAll(SHELL_ASSETS).catch(err => {
          console.warn('[PushSW] Some assets failed:', err);
        });
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[PushSW] Activating:', CACHE_NAME);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[PushSW] Deleting:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SW_UPDATED', version: CACHE_NAME });
        });
      });
    })
  );
  self.clients.claim();
});

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

const NOTIFICATION_ROUTES = {
  inbox: '/atlas/inbox',
  news: '/atlas/news',
  wiki: '/atlas/wiki',
  tv: '/atlas/tv',
  radio: '/atlas/radio',
  message: '/atlas/inbox',
  alert: '/atlas',
  system: '/atlas',
  default: '/atlas'
};

function getNotificationIcon(type) {
  const icons = {
    inbox: '/icons/owl-192.svg',
    news: '/icons/owl-192.svg',
    wiki: '/icons/owl-192.svg',
    tv: '/icons/owl-192.svg',
    radio: '/icons/owl-192.svg',
    message: '/icons/owl-192.svg',
    alert: '/icons/owl-192.svg',
    system: '/icons/p3-192.svg',
  };
  return icons[type] || '/icons/owl-192.svg';
}

self.addEventListener('push', (event) => {
  console.log('[PushSW] Push received');
  
  let data = { title: 'Atlas', body: 'New notification', type: 'default' };
  
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }
  
  const notificationType = data.type || 'default';
  const notificationTag = `atlas-${notificationType}-${data.id || Date.now()}`;
  
  const options = {
    body: data.body,
    icon: getNotificationIcon(notificationType),
    badge: '/icons/owl-192.svg',
    vibrate: [100, 50, 100],
    data: {
      ...data.data,
      type: notificationType,
      url: data.url || NOTIFICATION_ROUTES[notificationType] || NOTIFICATION_ROUTES.default,
      id: data.id,
      timestamp: Date.now(),
    },
    actions: data.actions || [],
    tag: notificationTag,
    renotify: data.renotify !== false,
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false,
  };
  
  if (data.image) {
    options.image = data.image;
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[PushSW] Notification clicked:', event.action, event.notification.tag);
  event.notification.close();
  
  const data = event.notification.data || {};
  const notificationType = data.type || 'default';
  
  let targetUrl = data.url || NOTIFICATION_ROUTES[notificationType] || NOTIFICATION_ROUTES.default;
  
  if (event.action) {
    switch (event.action) {
      case 'open':
        break;
      case 'reply':
        targetUrl = `${NOTIFICATION_ROUTES.inbox}?reply=${data.id || ''}`;
        break;
      case 'dismiss':
        return;
      case 'view':
        break;
      default:
        if (data.actions && data.actions[event.action]) {
          targetUrl = data.actions[event.action];
        }
    }
  }
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const atlasClient = clients.find(c => 
          c.url.includes('/atlas') || c.url.includes('/app')
        );
        
        if (atlasClient) {
          atlasClient.postMessage({
            type: 'NOTIFICATION_CLICK',
            notificationType,
            url: targetUrl,
            data: data,
          });
          return atlasClient.focus();
        }
        
        return self.clients.openWindow(targetUrl);
      })
  );
});

self.addEventListener('notificationclose', (event) => {
  console.log('[PushSW] Notification closed:', event.notification.tag);
  
  const data = event.notification.data || {};
  
  self.clients.matchAll({ type: 'window' }).then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'NOTIFICATION_DISMISSED',
        tag: event.notification.tag,
        data: data,
      });
    });
  });
});

self.addEventListener('sync', (event) => {
  console.log('[PushSW] Sync event:', event.tag);
  
  if (event.tag === 'nexus-anchor-sync' || event.tag === 'atlas-sync') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'DRAIN_QUEUE' });
        });
      })
    );
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;

  if (url.pathname.match(/\.(js|css)$/)) {
    event.respondWith(fetch(request));
    return;
  }

  if (url.pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|woff2?|ttf|eot|ico)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached || fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
