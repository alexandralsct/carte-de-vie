/* Hors ligne pour la variante « style LIFE » : cache des fichiers de l'app, réseau pour le reste.
   Cache propre à la variante (préfixe carte-life-) ; pas de contrôle d'empreinte (le contenu privé n'est pas dans ce dossier). */
const C = "carte-life-v9";
const FILES = ["./", "./index.html", "./life-style.css", "./app.js", "./manifest.webmanifest",
  "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png",
  "./fonts/instrument-sans.woff2", "./fonts/plex-mono-400.woff2", "./fonts/plex-mono-500.woff2"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(C).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("carte-life-") && k !== C).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== self.location.origin) return;
  /* réseau d'abord : une page ou une feuille de style mises à jour s'affichent tout de suite ; le cache sert hors ligne */
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok && res.type === "basic") {
        const copie = res.clone();
        caches.open(C).then((c) => c.put(e.request, copie));
      }
      return res;
    }).catch(() => caches.match(e.request).then((hit) => hit || caches.match("./index.html")))
  );
});
