// Ancienne adresse du jeu : ce service worker se retire lui-même et vide son cache.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('chasseur-dragons-')) await caches.delete(k);
    await self.registration.unregister();
    for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate('https://pikifou.github.io/chasseur-dragons/');
  })());
});
