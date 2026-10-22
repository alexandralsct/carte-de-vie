/* Remise à zéro de la mémoire de l'app sur cet appareil, quand elle plante à l'ouverture.
   Efface : la copie locale de la carte et le module personnel gardé en cache (la carte est rechargée depuis le dépôt),
   les fichiers de l'app gardés par le service worker. Garde : le lien avec le dépôt et sa clé, le lien avec le serveur,
   tous les autres réglages, et ce qui appartient aux autres apps servies à la même adresse.
   Par prudence, la copie locale est d'abord mise de côté dans IndexedDB (« carte-de-vie-reinit »). */
(function () {
  var journal = document.getElementById('journal');
  var dit = function (t) { var li = document.createElement('li'); li.textContent = t; journal.appendChild(li); };
  var ko = function (n) { return Math.round(n / 1024) + ' Ko'; };
  /* Constat avant effacement : noms et tailles seulement (jamais le contenu), pour trouver ce qui se remplit. */
  try {
    var L = [], tot = 0;
    for (var i = 0; i < localStorage.length; i++) { var c = localStorage.key(i), t = (localStorage.getItem(c) || '').length * 2 + c.length * 2; tot += t; L.push([c, t]); }
    L.sort(function (a, b) { return b[1] - a[1]; });
    dit('Mémoire locale de l\'adresse (toutes les apps) : ' + ko(tot) + ' pour ' + L.length + ' entrées. Les plus grosses :');
    L.slice(0, 8).forEach(function (x) { dit('· ' + x[0].slice(0, 40) + ' : ' + ko(x[1])); });
  } catch (_) { dit('Mémoire locale illisible.'); }
  if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(function (e) { dit('Stockage total utilisé par l\'adresse : ' + ko(e.usage || 0) + ' sur ' + ko(e.quota || 0) + '.'); }).catch(function () {});
  var A_EFFACER = ['carte-de-vie-v1', 'carte-de-vie-perso'];
  var copie = {};
  A_EFFACER.forEach(function (k) { try { var v = localStorage.getItem(k); if (v != null) copie[k] = v; } catch (_) {} });
  var metDeCote = function () {
    return new Promise(function (ok) {
      if (!Object.keys(copie).length || !window.indexedDB) return ok(false);
      try {
        var rq = indexedDB.open('carte-de-vie-reinit', 1);
        rq.onupgradeneeded = function () { rq.result.createObjectStore('copies'); };
        rq.onsuccess = function () {
          try {
            var tx = rq.result.transaction('copies', 'readwrite');
            tx.objectStore('copies').put({ quand: new Date().toISOString(), cles: copie }, Date.now());
            tx.oncomplete = function () { ok(true); }; tx.onerror = function () { ok(false); };
          } catch (_) { ok(false); }
        };
        rq.onerror = function () { ok(false); };
      } catch (_) { ok(false); }
    });
  };
  metDeCote().then(function (garde) {
    if (Object.keys(copie).length) dit(garde ? 'Copie locale mise de côté sur cet appareil.' : 'Copie locale non mise de côté (stockage indisponible).');
    A_EFFACER.forEach(function (k) { try { if (localStorage.getItem(k) != null) { localStorage.removeItem(k); dit('Effacé : ' + k); } } catch (_) {} });
    var caches_ = window.caches ? caches.keys().then(function (n) {
      return Promise.all(n.filter(function (x) { return x.indexOf('carte-de-vie-') === 0; }).map(function (x) { dit('Fichiers en cache effacés : ' + x); return caches.delete(x); }));
    }).catch(function () {}) : Promise.resolve();
    var sw = navigator.serviceWorker ? navigator.serviceWorker.getRegistrations().then(function (R) {
      var ici = new URL('./', location.href).href;
      return Promise.all(R.filter(function (r) { return r.scope === ici; }).map(function (r) { dit('Service de l\'app réinitialisé.'); return r.unregister(); }));
    }).catch(function () {}) : Promise.resolve();
    return Promise.all([caches_, sw]);
  }).then(function () {
    var lien = false; try { lien = !!localStorage.getItem('carte-de-vie-sync'); } catch (_) {}
    document.getElementById('etat').textContent = lien ? 'Terminé. Fais une capture de cette page : l\'app se rouvre d\'elle-même dans 12 secondes et recharge ta carte depuis le dépôt.' : 'Terminé. Attention : aucun lien avec le dépôt n\'est enregistré sur cet appareil.';
    document.getElementById('suite').hidden = false;
    if (lien) setTimeout(function () { location.replace('./index.html'); }, 12000);
  });
})();
