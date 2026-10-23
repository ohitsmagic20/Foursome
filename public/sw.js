// Foursome service worker: shows notifications and opens the right trip when one is tapped.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let msg = { title: 'Foursome', body: 'Something changed on your trip.', url: '/' };
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
