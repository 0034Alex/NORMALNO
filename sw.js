const CACHE_NAME = 'normalno-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const isPage = event.request.mode === 'navigate'
    || event.request.destination === 'document'
    || event.request.destination === 'script';

  if (isPage) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => caches.match(event.request))
    );
  } else {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  }
});

/* ---------- Web Push ---------- */
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data.json(); } catch (e) { data = { title: 'NORMALNO', body: event.data ? event.data.text() : '' }; }

  const title = data.title || 'NORMALNO';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-32.png',
    data: { url: data.url || '/index.html' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/index.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
