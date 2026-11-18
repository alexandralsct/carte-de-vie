/* Hors ligne pour la variante « style LIFE » : cache des fichiers de l'app, réseau pour le reste.
   Cache propre à la variante (préfixe carte-life-) ; pas de contrôle d'empreinte (le contenu privé n'est pas dans ce dossier). */
const C = "carte-life-v2";
const FILES = ["./", "./index.html", "./life-style.css", "./life-menu.js", "./manifest.webmanifest",
  "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./monde.js", "./lecture.js",
  "./reglages.js", "./recevoir.js", "./connexion.js", "./connexion.css",
  "./fonts/instrument-sans.woff2", "./fonts/plex-mono-400.woff2", "./fonts/plex-mono-500.woff2",
  "./fonts/plex-mono-600.woff2", "./fonts/plex-mono-700.woff2", "./fonts/plex-mono-400-italique.woff2"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(C).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("carte-life-") && k !== C).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(e.request).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).then((res) => {
        if (res.ok && res.type === "basic") {
          const copie = res.clone();
          caches.open(C).then((c) => c.put(e.request, copie));
        }
        return res;
      }).catch(() => caches.match("./index.html"));
    })
  );
});
