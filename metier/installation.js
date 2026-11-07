/* App « Métier » — enregistre le service worker (hors ligne) et gère le bouton « Installer l'app ». Aucun réseau. */
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js', { scope: './' }).catch(function () { /* l'app marche sans le hors-ligne */ });
  });
}
// Chrome ne propose l'installation que s'il juge l'app installable : le bouton n'apparaît que dans ce cas (même principe que l'app Tarot).
(function () {
  var demande = null, bouton = document.getElementById('installer');
  if (!bouton) return;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); demande = e; bouton.hidden = false; });
  window.addEventListener('appinstalled', function () { demande = null; bouton.hidden = true; });
  bouton.addEventListener('click', function () {
    if (!demande) return;
    demande.prompt();
    Promise.resolve(demande.userChoice).then(function () { demande = null; bouton.hidden = true; }, function () { demande = null; bouton.hidden = true; });
  });
})();
