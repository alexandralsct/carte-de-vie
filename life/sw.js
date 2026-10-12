// LIFE a déménagé : ce service worker s'efface lui-même et vide son cache.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.map(n => n.startsWith('life') ? caches.delete(n) : 0))).then(() => self.registration.unregister())));
