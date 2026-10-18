/* Service worker : le jeu entier est mis en cache à l'installation, et joue hors ligne.
   81ea6c55e4 est remplacé à chaque build : nouveau cache, ancien supprimé. */
const CACHE = 'tour-aimants-81ea6c55e4';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png', './favicon.png',
  "./assets/armure.png", "./assets/armure_tas.png", "./assets/chat_assis.png", "./assets/chat_cage.png", "./assets/chat_saute.png", "./assets/epee.png", "./assets/epouvantail.png", "./assets/heros.png", "./assets/heros_helice.png", "./assets/magnetite.png", "./assets/sorciere.png", "./assets/sorciere_balai.png", "./assets/sorciere_vol.png", "./assets/tour.jpg"
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('tour-aimants-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // polices Google : réseau d'abord, copie en cache pour le hors ligne
  if (url.hostname.endsWith('gstatic.com') || url.hostname.endsWith('googleapis.com')) {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; }).catch(() => caches.match(req)));
    return;
  }
  // le reste : cache d'abord
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => { if (res.ok && url.origin === location.origin) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; })));
});
