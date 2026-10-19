/* Réglages rangés (v232) : code public, aucun texte personnel. Il ne retire rien : il déplace les lignes déjà présentes
   (leurs boutons gardent leurs actions) et met « Connexion » en tête, avec la clé du lien. Idempotent. */
(function () {
  'use strict';
  var pg = document.getElementById('setPage');
  if (!pg || pg.dataset.v232) return;
  var groupes = pg.querySelectorAll('details.setgrp');
  if (!groupes.length) return;
  pg.dataset.v232 = '1';
  var G = {};
  groupes.forEach(function (d) {
    var s = d.querySelector('summary > span');
    var t = s && s.firstChild ? s.firstChild.textContent.trim() : '';
    if (t) G[t] = d;
  });
  function ligne(id) { var e = document.getElementById(id); return e ? e.closest('li') : null; }
  function liste(d) { return d ? d.querySelector('ul.setlist') : null; }
  function nomme(d, titre, sous) {
    var s = d.querySelector('summary > span'); if (!s) return;
    s.firstChild.textContent = titre;
    var p = s.querySelector('small');
    if (p) p.textContent = sous; else if (sous) { p = document.createElement('small'); p.textContent = sous; s.appendChild(p); }
  }
  /* 1. « Connexion » : en tête, ouverte. Une ligne qui ouvre l'écran Connexion (code, QR, clé du lien, test), puis la synchro et l'IA. */
  var cx = document.createElement('details'); cx.className = 'setgrp'; cx.id = 'setConnexion'; cx.open = true;
  var sm = document.createElement('summary'), sp = document.createElement('span'), pt = document.createElement('small');
  sp.appendChild(document.createTextNode('Connexion')); pt.textContent = 'code, clé du lien, synchronisation, IA'; sp.appendChild(pt);
  var ic = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  ic.setAttribute('viewBox', '0 0 24 24'); ic.setAttribute('class', 'stico'); ic.setAttribute('aria-hidden', 'true');
  ic.innerHTML = '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>';
  sm.append(ic, sp); cx.appendChild(sm);
  var ul = document.createElement('ul'); ul.className = 'setlist'; cx.appendChild(ul);
  var li = document.createElement('li'); li.className = 'go';
  li.innerHTML = '<button type="button" class="rowbtn" id="cxBtn"><span><b>Code et clé du lien</b><small>Connecter un appareil, coller un code, tout tester</small></span><i aria-hidden="true">→</i></button>';
  li.querySelector('button').onclick = function () { if (window.CLEF && window.CLEF.ouvre) window.CLEF.ouvre(); };
  ul.appendChild(li);
  ['syncBtn', 'iaSet'].forEach(function (id) { var l = ligne(id); if (l) ul.appendChild(l); });
  var premier = pg.querySelector('details.setgrp');
  premier.parentNode.insertBefore(cx, premier);
  /* 2. « Données et connexions » devient « Sauvegardes et appareil » ; « Autres » (une seule ligne, sans titre clair) s'y range. */
  var dn = G['Données et connexions'];
  if (dn) {
    nomme(dn, 'Sauvegardes et appareil', 'exporter, importer, effacer cet appareil');
    var cible = liste(dn), au = G['Autres'];
    if (au && cible) {
      Array.prototype.slice.call(au.querySelectorAll('ul.setlist > li')).forEach(function (l) { cible.appendChild(l); });
      if (!au.querySelector('ul.setlist > li')) au.remove();
    }
  }
  var lead = pg.querySelector('.hero .lead');
  if (lead) lead.textContent = 'Connexion, apparence de ta carte sur cet appareil, et tes données.';
})();
