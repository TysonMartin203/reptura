const CACHE = 'reptura-v1';
const STATIC = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install: cache static shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC))
  );
  self.skipWaiting();
});

// Activate: clear old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for assets
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  
  // Never cache API calls
  if (url.pathname.startsWith('/api') || url.hostname !== self.location.hostname) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Network-first for HTML (always get fresh app shell)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Cache-first for static assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
      return cached || network;
    })
  );
});

// Push: show a notification for buzzes, invites, shared plans, etc.
self.addEventListener('push', e => {
  let payload = { title: 'Reptura', body: 'You have a new notification' };
  try { payload = e.data.json(); } catch {}
  e.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: payload.data || {},
    })
  );
});

// Notification click: focus/open the app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const targetUrl = e.notification.data?.type === 'buzz' ? '/dashboard'
    : e.notification.data?.type === 'meal_share' ? '/meals'
    : e.notification.data?.type === 'train_invite' ? '/social'
    : '/dashboard';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) { client.navigate(targetUrl); return client.focus(); }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
