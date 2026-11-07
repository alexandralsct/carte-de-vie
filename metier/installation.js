/* App « Métier » — enregistre le service worker (hors ligne). Aucun réseau : le fichier sw.js vient du même dossier. */
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js', { scope: './' }).catch(function () { /* l'app marche sans le hors-ligne */ });
  });
}
