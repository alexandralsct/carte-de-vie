// LIFE a déménagé : ce service worker (ancienne adresse) vide SEULEMENT le cache de l'ancienne LIFE, puis s'efface lui-même.
// Les caches de la nouvelle LIFE (« life-V.… ») et des autres apps du site ne sont jamais touchés.
const ANCIENS = ['life-v1'];
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => ANCIENS.includes(n)).map(n => caches.delete(n)))).then(() => self.registration.unregister())));
