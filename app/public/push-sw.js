/* Remy: show reminders that arrive while the app is closed, and open the right screen when tapped.
   Loaded into the generated service worker (see workbox.importScripts in vite.config.ts). */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const scope = self.registration.scope;
  event.waitUntil(
    self.registration.showNotification(data.title || 'Remy', {
      body: data.body || '',
      tag: data.tag || undefined,
      icon: scope + 'pwa-192x192.png',
      badge: scope + 'pwa-64x64.png',
      data: { url: data.url || '' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const scope = self.registration.scope;
  const screen = (event.notification.data && event.notification.data.url) || '';
  const target = scope + (screen ? '?open=' + encodeURIComponent(screen) : '');
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(scope));
      if (open) {
        open.postMessage({ type: 'remy-open', screen });
        return open.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
