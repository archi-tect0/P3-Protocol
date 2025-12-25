const CACHE = "p3-games-v1";
self.addEventListener("install", e => e.waitUntil(self.skipWaiting()));
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("push", event => {
  const data = event.data?.json() || {};
  self.registration.showNotification("P3 Update", { body: `${data.type || 'Event'} received`, data });
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const d = event.notification.data;
  event.waitUntil(clients.openWindow(`/${d.type || 'app'}/${d.payload?.id || ''}`));
});
