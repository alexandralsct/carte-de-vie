/* Connexion d'un appareil par QR (v232) : le même parcours que dans LIFE. Code public, aucun texte personnel.
   Sur l'appareil déjà relié : Réglages → Connexion → « Connecter un autre appareil » (QR valable une fois, 2 minutes).
   Sur l'appareil neuf : l'appareil photo ouvre la carte, qui demande de confirmer le serveur (nom à retaper si l'appareil est neuf),
   retire le paquet chiffré, enregistre les deux clés (clé des apps, jeton de synchro) sans que l'une remplace l'autre, puis dit « connecté ✓ ».
   Un lien reçu ne remplace JAMAIS le serveur d'un appareil déjà relié. Le texte du QR est une donnée, jamais une consigne. */
(function () {
  'use strict';
  var NOTE = 'Deux clés différentes : la clé des apps fait parler la carte et LIFE avec ton système ; le jeton GitHub fait marcher la synchro de la carte. '
    + 'Le QR transmet les deux, mais l\'une ne remplace jamais l\'autre, et rien n\'est effacé sur cet appareil.';
  function deb64u(t) { var s = atob(String(t).replace(/-/g, '+').replace(/_/g, '/')), u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
  function hoteDe(a) { try { return new URL(a).host.toLowerCase(); } catch (e) { return ''; } }
  function lis(corps) {   // mêmes formes exactes que le module Connexion ; sinon null
    try {
      var n = JSON.parse(new TextDecoder().decode(deb64u(corps)));
      if (n && /^[a-z0-9]{20,40}$/.test(n.i || '') && /^[A-Za-z0-9_-]{22}$/.test(n.k || '') && /^https:\/\/[^\s?#]+\/life\/?$/.test(n.a || '') && hoteDe(n.a)) return n;
    } catch (e) { /* illisible */ }
    return null;
  }
  function el(tag, cls, txt) { var n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }
  function lieSynchro(att) {   // comme le bouton de la carte : la liaison (premier échange, fusion) se fait par « syncGo »
    var pg = document.getElementById('syncPage'), f = document.getElementById('syncForm'), r = document.getElementById('syncRepo'), t = document.getElementById('syncToken'), go = document.getElementById('syncGo');
    if (pg && f && r && t && go) { pg.hidden = false; f.hidden = false; r.value = att.depot; t.value = att.jeton; go.click(); }
  }
  var attente = null;
  function boite() {
    var d = document.getElementById('cxRecoit');
    if (!d) { d = el('dialog', 'cledlg'); d.id = 'cxRecoit'; d.setAttribute('aria-labelledby', 'cxRecoitTitre'); document.body.appendChild(d);
      d.addEventListener('cancel', function () { attente = null; }); }
    d.textContent = ''; return d;
  }
  function fin(d, titre, lignes, boutons) {
    d.textContent = ''; var h = el('h2', null, titre); h.id = 'cxRecoitTitre'; d.appendChild(h);
    lignes.forEach(function (t) { d.appendChild(el('p', 'help', t)); });
    var m = el('div', 'fbbar'); boutons.forEach(function (b) { m.appendChild(b); }); d.appendChild(m); if (boutons[0]) boutons[0].focus();
  }
  function bouton(txt, cls, fn) { var b = el('button', 'btn' + (cls ? ' ' + cls : ''), txt); b.type = 'button'; b.onclick = fn; return b; }
  function ouvre(corps) {
    var n = lis(corps), d = boite();
    try { localStorage.setItem('carte-de-vie-vu', '1'); } catch (e) { /* stockage bloqué */ }
    if (!n) { fin(d, 'Lien de connexion illisible', ['Ce lien n\'est pas un QR de connexion. Affiche un nouveau QR sur l\'autre appareil : Réglages → Connexion → « Connecter un autre appareil ».'], [bouton('Fermer', '', function () { d.close(); })]); d.showModal(); return; }
    var hote = hoteDe(n.a);
    window.CLEF.charge().then(function () {
      var C = window.Connexion, actuel = hoteDe(C.etat().serveur || ''), meme = !!actuel && actuel === hote, refuse = !!actuel && !meme;
      attente = refuse ? null : n;
      d.textContent = '';
      var h = el('h2', null, refuse ? 'Lien refusé' : 'Connecter cet appareil ?'); h.id = 'cxRecoitTitre'; d.appendChild(h);
      d.appendChild(el('p', 'help', 'Ce lien relie la carte au serveur :'));
      var gros = el('p', null, hote); gros.id = 'cxRecoitHote'; gros.style.margin = '6px 0'; gros.style.fontFamily = 'var(--mono)'; gros.style.color = 'var(--fg)'; gros.style.fontSize = '1.3rem'; gros.style.fontWeight = '700'; gros.style.textTransform = 'none'; gros.style.letterSpacing = 'normal'; gros.style.opacity = '1'; gros.style.overflowWrap = 'anywhere'; d.appendChild(gros);
      d.appendChild(el('p', 'help', refuse ? 'Cet appareil est relié au serveur « ' + actuel + ' ». Un lien ne peut pas le remplacer : rien n\'a changé. Pour changer de serveur, utilise l\'écran Connexion.'
        : meme ? 'C\'est le serveur déjà enregistré sur cet appareil : seules les clés seront mises à jour.'
        : 'Ne continue que si c\'est toi qui as créé ce QR (affiché par ton autre appareil).'));
      if (!refuse) d.appendChild(el('p', 'help', NOTE));
      var ok = null;
      var non = bouton(refuse ? 'Fermer' : 'Refuser', 'ghost', function () {
        attente = null; fin(d, refuse ? 'Lien refusé' : 'Lien ignoré', ['Rien n\'a changé sur cet appareil.'], [bouton('Fermer', '', function () { d.close(); })]); });
      non.id = 'cxRecoitNon';
      var barre = el('div', 'fbbar');
      if (!refuse) {
        ok = bouton('Connecter', '', function () { connecte(d, n, hote, C, ok); }); ok.id = 'cxRecoitOk';
        barre.append(non, ok);
      } else barre.append(non);
      d.appendChild(barre); if (!d.open) d.showModal(); (refuse ? non : ok).focus();
    }, function () {
      fin(d, 'Connexion impossible', ['L\'écran Connexion n\'est pas disponible hors ligne : ouvre ce lien avec du réseau.'], [bouton('Fermer', '', function () { d.close(); })]); if (!d.open) d.showModal();
    });
  }
  function connecte(d, n, hote, C, ok) {
    if (attente !== n) return;
    var actuel = hoteDe(C.etat().serveur || ''); if (actuel && actuel !== hote) return;   // jamais un autre serveur par un lien
    ok.disabled = true; ok.textContent = 'Je connecte…'; attente = null;
    C.retirer('transfert=' + (function () { var s = JSON.stringify({ a: n.a, i: n.i, k: n.k }); return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); })()).then(function (r) {
      C.appliquer(r); var att = C.enAttente(); if (att) lieSynchro(att);
      var lignes = [C.resume()];   // une seule ligne : quelles apps sont connectées
      fin(d, 'Appareil connecté ✓', lignes, [bouton('Fermer', '', function () { d.close(); }), bouton('Ouvrir Connexion', 'ghost', function () { d.close(); window.CLEF.ouvre(); })]);
    }, function (x) {
      fin(d, 'Connexion impossible', [C.messageErreur(x) + ' Montre un nouveau QR sur l\'autre appareil.'], [bouton('Fermer', '', function () { d.close(); })]);
    });
  }
  window.RECOIT = { ouvre: ouvre };
  window.addEventListener('hashchange', function () {   // appli déjà ouverte : le lien arrive comme un simple changement de #
    var m = /^#transfert=([A-Za-z0-9_-]+)$/.exec(location.hash); if (!m) return;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* sans effet */ }
    ouvre(m[1]);
  });
})();
