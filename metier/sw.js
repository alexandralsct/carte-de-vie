// Métier, ancienne adresse (/carte-de-vie/metier/) : service worker de transfert. À l'activation il supprime les anciens caches « metier- »
// (jamais « metier2- », ceux de la nouvelle adresse), se désinscrit et recharge ses pages. Aucun accès à localStorage ni à autre chose.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const n of await caches.keys()) if (n.startsWith('metier-')) await caches.delete(n);
    await self.registration.unregister();
    for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url).catch(() => {});
  })());
});
