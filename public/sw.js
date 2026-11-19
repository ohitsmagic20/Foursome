// Foresome service worker: shows notifications, opens the right trip when one is tapped,
// and keeps trip pages working with no signal (on the course).
const CACHE = 'foresome-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

// The page lists what it already loaded before this worker was running, so a first visit works offline too.
self.addEventListener('message', (event) => {
  const d = event.data || {};
  if (d.type !== 'cache' || !Array.isArray(d.urls)) return;
  event.waitUntil((async () => {
    const c = await caches.open(CACHE);
    for (const u of d.urls.slice(0, 80)) {
      try {
        const url = new URL(u, self.location.origin);
        if (url.origin !== self.location.origin) continue;
        const key = url.pathname.startsWith('/_next/static/') ? url.href : url.pathname;
        if (!(await c.match(key))) { const res = await fetch(url.href); if (res.ok) await c.put(key, res); }
      } catch (_) { /* skip it */ }
    }
  })());
});

// Trip pages: the network first, the last copy when there's no signal.
// App code and fonts (their names change with every release): the saved copy first.
// Everything else (the API included) goes straight to the network; the app keeps its own copy of the trip.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate' && (url.pathname.startsWith('/t/') || url.pathname === '/')) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) { const c = await caches.open(CACHE); await c.put(url.pathname, res.clone()); }
        return res;
      } catch (e) {
        const hit = await caches.match(url.pathname);
        if (hit) return hit;
        throw e;
      }
    })());
    return;
  }
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/pdf-fonts/')) {
    event.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) { const c = await caches.open(CACHE); await c.put(req, res.clone()); }
      return res;
    })());
  }
});

self.addEventListener('push', (event) => {
  let msg = { title: 'Foresome', body: 'Something changed on your trip.', url: '/' };
  try { msg = { ...msg, ...event.data.json() }; } catch (_) { /* plain text or empty */ }
  event.waitUntil(self.registration.showNotification(msg.title, {
    body: msg.body,
    tag: msg.tag,
    icon: '/apple-icon',
    badge: '/apple-icon',
    data: { url: msg.url },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if ('focus' in w) { await w.navigate(url).catch(() => {}); return w.focus(); }
    }
    return self.clients.openWindow(url);
  })());
});
