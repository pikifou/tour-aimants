/* Service worker : le jeu entier est mis en cache à l'installation, et joue hors ligne.
   3523e84313 est remplacé à chaque build : nouveau cache, ancien supprimé. */
const CACHE = 'tour-aimants-3523e84313';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png', './favicon.png',
  "./assets/armure.png", "./assets/armure_tas.png", "./assets/chat_assis.png", "./assets/chat_cage.png", "./assets/chat_saute.png", "./assets/epee.png", "./assets/epouvantail.png", "./assets/heros.png", "./assets/heros_helice.png", "./assets/magnetite.png", "./assets/matiere-bois.webp", "./assets/matiere-fer.webp", "./assets/matiere-pierre.webp", "./assets/matiere-verre.webp", "./assets/mur-01.webp", "./assets/mur-02.webp", "./assets/mur-03.webp", "./assets/mur-04.webp", "./assets/mur-05.webp", "./assets/mur-06.webp", "./assets/mur-07.webp", "./assets/mur-08.webp", "./assets/mur-09.webp", "./assets/mur-10.webp", "./assets/mur-11.webp", "./assets/mur-12.webp", "./assets/mur-13.webp", "./assets/mur-14.webp", "./assets/mur-15.webp", "./assets/mur-16.webp", "./assets/sorciere.png", "./assets/sorciere_balai.png", "./assets/sorciere_vol.png", "./assets/tour.jpg"
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
  // la fiche Ludiworld : toujours le réseau, jamais en cache
  if (url.pathname.endsWith('/ludi.json')) return;
  // le reste : cache d'abord
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => { if (res.ok && url.origin === location.origin) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; })));
});
