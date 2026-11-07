/* App « Métier » — écrans. Les calculs sont dans logique.js, les fiches dans donnees.js.
   Données : stockage du navigateur de cet appareil seulement (try/catch partout) ; export et import JSON. */
(function () {
  'use strict';
  var M = Metier, D = MetierDonnees;

  /* ================= état et stockage ================= */
  var stockageOk = true;
  function charger() {
    try { var t = localStorage.getItem(M.CLE_STOCKAGE); if (t) { var r = M.importer(t); if (r.ok) return r.etat; } } catch (e) { stockageOk = false; }
    return M.etatVide();
  }
  var etat = charger();
  function sauver() {
    try { localStorage.setItem(M.CLE_STOCKAGE, M.exporter(etat)); } catch (e) { stockageOk = false; majAlerteStockage(); }
  }
  var ui = { ecran: 'classement', sous: { pistes: 'fiches', tests: 'tests', recolte: 'relire' }, ouvrir: null, carteIdx: 0, carnetPiste: null, filtre: 'tous',
    recolte: { etat: 'propose', famille: 'toutes', max: 40, message: '' },
    filtreClassement: 'tout', nbVisibles: 10, detail: null };
  /* L'app s'ouvre toujours sur le classement (aucun écran retenu entre deux visites). */

  /* ================= petits outils ================= */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    for (var k in (attrs || {})) {
      if (k === 'class') el.className = attrs[k];
      else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) el.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    }
    for (var i = 2; i < arguments.length; i++) ajouter(el, arguments[i]);
    return el;
  }
  function ajouter(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { ajouter(el, x); }); return; }
    el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
  function fr(n, d) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: d === undefined ? 0 : d });
  }
  function eur(n, d) { return n === null || n === undefined ? '—' : fr(n, d) + ' €'; }
  function aujourdhui() { return new Date().toISOString().slice(0, 10); }
  function puce(texte, classe) { return h('span', { class: 'puce ' + (classe || 'neutre') }, texte); }
  var SUPPOSE = function () { return puce('supposé', 'ex'); };

  function fixer(chemin, valeur) {
    var o = etat;
    for (var i = 0; i < chemin.length - 1; i++) {
      if (o[chemin[i]] === undefined || o[chemin[i]] === null || typeof o[chemin[i]] !== 'object') o[chemin[i]] = {};
      o = o[chemin[i]];
    }
    o[chemin[chemin.length - 1]] = valeur;
  }
  function lire(chemin) {
    var o = etat;
    for (var i = 0; i < chemin.length; i++) { if (o === undefined || o === null) return undefined; o = o[chemin[i]]; }
    return o;
  }

  /* zones de résultats : recalculées à chaque saisie, sans toucher aux champs (le curseur ne saute pas) */
  var sorties = [];
  function sortie(tag, fn, attrs) {
    var el = h(tag || 'div', attrs);
    sorties.push({ el: el, fn: fn });
    fn(el);
    return el;
  }
  function rafraichir() {
    sorties = sorties.filter(function (s) { if (s.el.isConnected) { s.dejaMonte = true; return true; } return !s.dejaMonte; });
    sorties.forEach(function (s) { s.el.textContent = ''; s.fn(s.el); });
  }

  /* un champ de saisie : o = { type, get, set, options, step, min, placeholder, rows, supp } */
  function saisie(o) {
    var type = o.type || 'text', el;
    if (type === 'textarea') { el = h('textarea', { rows: o.rows || 3 }); el.value = o.get() || ''; }
    else if (type === 'select') {
      el = h('select');
      o.options.forEach(function (x) { el.appendChild(h('option', { value: x[0] }, x[1])); });
      el.value = o.get() === null || o.get() === undefined ? '' : o.get();
    } else if (type === 'checkbox') { el = h('input', { type: 'checkbox' }); el.checked = !!o.get(); }
    else {
      el = h('input', { type: type });
      if (type === 'number') { el.setAttribute('inputmode', 'decimal'); el.setAttribute('step', o.step || 'any'); if (o.min !== undefined) el.setAttribute('min', o.min); }
      var v = o.get(); el.value = v === null || v === undefined ? '' : v;
    }
    if (o.placeholder) el.setAttribute('placeholder', o.placeholder);
    if (o.label) el.setAttribute('aria-label', o.label);
    var evt = (type === 'select' || type === 'checkbox' || type === 'date' || type === 'month') ? 'change' : 'input';
    el.addEventListener(evt, function () {
      var v = type === 'checkbox' ? el.checked : type === 'number' ? M.nombre(el.value) : el.value;
      o.set(v);
      if (o.badge && o.badge.parentNode) o.badge.parentNode.removeChild(o.badge);
      sauver(); rafraichir();
    });
    return el;
  }
  function champ(label, o) {
    if (o.supp) o.badge = SUPPOSE();
    var el = saisie(o);
    return o.type === 'checkbox' ? h('label', { class: 'ligne' }, el, label) : h('label', null, h('span', null, label, o.badge ? ' ' : '', o.badge || null), el);
  }
  function liant(chemin, extra) {
    var o = { get: function () { return lire(chemin); }, set: function (v) { fixer(chemin, v); } };
    for (var k in (extra || {})) o[k] = extra[k];
    return o;
  }
  function bloc(titre, idees, contenu) {
    return h('section', { class: 'bloc', 'data-idee': idees || null }, h('h2', null, titre), contenu);
  }
  function note(texte) { return h('p', { class: 'note' }, texte); }
  function grille() { return h.apply(null, ['div', { class: 'grille' }].concat([].slice.call(arguments))); }

  /* ================= pistes ================= */
  function bases() { return D.PISTES.concat(etat.pistesPerso || []); }
  function pistes() { return bases().map(function (b) { return M.fusionnerPiste(b, (etat.pistes || {})[b.id]); }); }
  function pistesVives() { return pistes().filter(function (p) { return p.statut !== 'elimine'; }); }
  function piste(id) { return pistes().filter(function (p) { return p.id === id; })[0]; }
  function reglages() {
    var r = etat.cahier.reglages || {};
    var hj = M.nombre(r.heuresParJour), sa = M.nombre(r.semainesAn);
    return { heuresParJour: hj === null ? M.REGLAGES_DEFAUT.heuresParJour : hj, semainesAn: sa === null ? M.REGLAGES_DEFAUT.semainesAn : sa };
  }
  function scenario() { return etat.compteur.scenario === 'haut' ? 'haut' : 'bas'; }
  function marge() { return M.nombre(etat.cahier.marge); }
  function besoinAnnuel() { var b = M.nombre(etat.compteur.besoinMensuel); return b === null ? null : b * 12; }
  function nomOption(liste, id) { var r = liste.filter(function (x) { return x.id === id; })[0]; return r ? r.nom : id; }

  function formeDistance(d) { return d === 'totale' || d === 'principale' ? ['✓ ', 'ok'] : d === 'surplace' ? ['✗ ', 'non'] : d === 'partielle' ? ['~ ', 'ex'] : ['? ', 'neutre']; }

  /* ================= écrans ================= */
  var ECRANS = [
    { id: 'recolte', nom: 'Ce que tu t\'es déjà dit', f: ecranRecolte },
    { id: 'cahier', nom: 'Cahier des charges', f: ecranCahier },
    { id: 'compteur', nom: 'Compteur', f: ecranCompteur },
    { id: 'pistes', nom: 'Pistes', f: ecranPistes },
    { id: 'tests', nom: 'Tests', f: ecranTests },
    { id: 'decision', nom: 'Décision', f: ecranDecision },
    { id: 'mural', nom: 'Vue murale', f: ecranMural }
  ];

  function sousOnglets(cle, liste, rendus) {
    var contenu = h('div', { class: 'cartes' });
    var barre = h('div', { class: 'sous-onglets', role: 'tablist' });
    liste.forEach(function (x) {
      barre.appendChild(h('button', { class: 'onglet', role: 'tab', type: 'button', 'aria-selected': ui.sous[cle] === x[0] ? 'true' : 'false',
        onclick: function () { ui.sous[cle] = x[0]; afficher(true); } }, x[1]));
    });
    contenu.appendChild(rendus[ui.sous[cle]]());
    return h('div', { class: 'cartes' }, barre, contenu);
  }

  /* ---------- 0. Ce que tu t'es déjà dit (lot 3 : la récolte) ---------- */
  var NOMS_ETAT = { propose: 'à relire', garde: 'gardée', ecarte: 'écartée' };
  function familleNom(id) { var f = M.familleRecolte(id); return f ? f.nom : id; }
  function decider(id, etatLigne) {
    etat.recolte.lignes = M.decider(etat.recolte.lignes, id, etatLigne);
    sauver(); afficher(true);
  }
  function carteLigne(l, boutons) {
    var f = M.familleRecolte(l.famille);
    return h('article', { class: 'carte' + (l.etat === 'ecarte' ? ' ecartee' : ''), 'data-ligne': l.id, 'data-idee': l.idee || (f ? f.idee : null) },
      h('div', { class: 'rang' }, puce(familleNom(l.famille), 'neutre'), puce(NOMS_ETAT[l.etat], l.etat === 'garde' ? 'ok' : l.etat === 'ecarte' ? 'non' : 'ex')),
      h('p', null, '« ', l.texte, ' »'),
      h('p', { class: 'note' }, h('strong', null, 'Source : '), l.source, l.date ? ' (' + l.date + ')' : ''),
      l.note ? h('p', { class: 'note' }, h('strong', null, 'Lecture automatique, à contester : '), l.note) : null,
      h('div', { class: 'rang' }, boutons, l.idee === 'I5' || l.famille === 'lectures'
        ? h('button', { class: 'discret', type: 'button', 'aria-pressed': (etat.recolte.marques || {})[l.id] ? 'true' : 'false', onclick: function () {
          etat.recolte.marques = M.marquer(etat.recolte.marques, l.id); sauver(); afficher(true);
        } }, (etat.recolte.marques || {})[l.id] ? '★ Cette fiche me marque' : '☆ Cette fiche me marque')
        : null));
  }
  function boutonsLigne(l) {
    var b = [];
    if (l.etat !== 'garde') b.push(h('button', { class: l.etat === 'propose' ? 'action' : 'discret', type: 'button', onclick: function () { decider(l.id, 'garde'); } }, 'Garder'));
    if (l.etat !== 'ecarte') b.push(h('button', { class: 'discret', type: 'button', onclick: function () { decider(l.id, 'ecarte'); } }, 'Écarter'));
    if (l.etat !== 'propose') b.push(h('button', { class: 'discret', type: 'button', onclick: function () { decider(l.id, 'propose'); } }, 'Remettre à relire'));
    return b;
  }
  function panneauImportRecolte() {
    var message = h('p', { class: 'note', role: 'status' }, ui.recolte.message || '');
    function appliquer(texte, nomFichier) {
      var r = M.lireRecolte(texte);
      if (!r.ok) { message.textContent = 'Import impossible : ' + r.erreur + ' Rien n\'a été changé.'; return; }
      var f = M.fusionnerRecolte(etat.recolte.lignes, r.lignes);
      etat.recolte.lignes = f.lignes;
      etat.recolte.imports = (etat.recolte.imports || []).concat([{ fichier: nomFichier || 'texte collé', date: aujourdhui(), ajoutees: f.ajoutees, deja: f.deja, refusees: r.rejetees.length }]).slice(-20);
      sauver();
      ui.recolte.message = f.ajoutees + ' ligne(s) ajoutée(s), ' + f.deja + ' déjà là (ton choix est gardé), ' + r.rejetees.length + ' refusée(s)' +
        (r.rejetees.length ? ' (' + r.rejetees.slice(0, 5).map(function (x) { return 'n° ' + x.n + ' : ' + x.raison; }).join(' ; ') + (r.rejetees.length > 5 ? '…' : '') + ')' : '') + '.';
      ui.recolte.etat = 'propose';
      afficher(true);
    }
    var fichier = h('input', { type: 'file', accept: 'application/json,.json,.txt', 'aria-label': 'Fichier de récolte à importer' });
    fichier.addEventListener('change', function () {
      var f = fichier.files && fichier.files[0]; if (!f) return;
      var lecteur = new FileReader();
      lecteur.onload = function () { appliquer(String(lecteur.result), f.name); fichier.value = ''; };
      lecteur.onerror = function () { message.textContent = 'Le fichier n\'a pas pu être lu.'; };
      lecteur.readAsText(f);
    });
    var collage = h('textarea', { rows: 3, placeholder: 'Ou colle ici le texte du fichier de récolte', 'aria-label': 'Coller le texte d\'une récolte' });
    return h('div', { class: 'cartes' },
      note('Les récoltes sont préparées en dehors de cette page et enregistrées dans un fichier. Importe ici le fichier : rien d\'autre n\'est lu, et ce que tu as déjà décidé ne bouge pas.'),
      h('label', null, 'Importer un fichier de récolte', fichier),
      h('details', null, h('summary', null, 'Coller le texte plutôt qu\'un fichier'), h('div', { class: 'cartes' }, collage,
        h('button', { class: 'discret', type: 'button', onclick: function () { appliquer(collage.value, ''); } }, 'Importer le texte collé'))),
      message);
  }
  function ongletRelire() {
    var f = ui.recolte, lignes = etat.recolte.lignes, c = M.comptesRecolte(lignes);
    var selEtat = h('select', { 'aria-label': 'État des lignes', onchange: function (e) { f.etat = e.target.value; f.max = 40; afficher(true); } },
      [['propose', 'À relire (' + c.propose + ')'], ['garde', 'Gardées (' + c.garde + ')'], ['ecarte', 'Écartées (' + c.ecarte + ')'], ['toutes', 'Toutes (' + lignes.length + ')']]
        .map(function (o) { return h('option', { value: o[0], selected: f.etat === o[0] }, o[1]); }));
    var selFam = h('select', { 'aria-label': 'Famille', onchange: function (e) { f.famille = e.target.value; f.max = 40; afficher(true); } },
      [h('option', { value: 'toutes', selected: f.famille === 'toutes' }, 'Toutes les familles')].concat(M.FAMILLES_RECOLTE.map(function (x) {
        var n = lignes.filter(function (l) { return l.famille === x.id; }).length;
        return h('option', { value: x.id, 'data-idee': x.idee, selected: f.famille === x.id }, x.nom + ' (' + n + ')');
      })));
    var liste = sortie('div', function (e) {
      var vues = lignes.filter(function (l) { return (f.etat === 'toutes' || l.etat === f.etat) && (f.famille === 'toutes' || l.famille === f.famille); });
      if (!lignes.length) { e.appendChild(h('p', { class: 'vide' }, 'Rien encore. Importe un fichier de récolte ci-dessus, ou écris toi-même ce que tu veux du travail (onglet « Ce que je veux du travail »).')); return; }
      if (!vues.length) { e.appendChild(h('p', { class: 'vide' }, f.etat === 'propose' ? 'Tout a été relu : rien ne reste à garder ou à écarter.' : 'Aucune ligne avec ce filtre.')); return; }
      vues.slice(0, f.max).forEach(function (l) { e.appendChild(carteLigne(l, boutonsLigne(l))); });
      if (vues.length > f.max) e.appendChild(h('button', { class: 'discret', type: 'button', onclick: function () { f.max += 40; afficher(true); } }, 'Voir ' + Math.min(40, vues.length - f.max) + ' de plus (' + (vues.length - f.max) + ' restantes)'));
    }, { class: 'cartes' });
    return bloc('Ce que tu t\'es déjà dit', 'I1', h('div', { class: 'cartes' },
      note('Ton travail idéal, d\'après ce que tu as déjà écrit, gardé ou fait. Chaque ligne cite sa source ; aucune n\'est une conclusion. Garde ce qui est juste, écarte le reste : ce que tu écartes sert ensuite à éliminer.'),
      panneauImportRecolte(),
      sortie('div', function (e) {
        var m = M.lignesMarquees(etat.recolte.lignes, etat.recolte.marques);
        if (!m.length) { e.appendChild(note('Pour les lectures de ta liste, le bouton « ☆ Cette fiche me marque » est à toi : l\'app ne devine pas lesquelles te marquent.')); return; }
        e.appendChild(h('div', { class: 'carte', 'data-idee': 'I5' }, h('h3', null, 'Les fiches qui te marquent (' + m.length + ')'),
          h('ul', { class: 'sources' }, m.map(function (l) { return h('li', null, l.texte); }))));
      }),
      h('div', { class: 'grille' }, h('label', null, 'Montrer', selEtat), h('label', null, 'Famille', selFam)),
      liste));
  }
  function ongletVeux() {
    var lignes = etat.recolte.lignes.filter(function (l) { return l.famille === 'veux'; });
    var gardees = lignes.filter(function (l) { return l.etat === 'garde'; }), aRelire = lignes.filter(function (l) { return l.etat === 'propose'; });
    var zone = h('textarea', { rows: 3, placeholder: 'Une phrase de toi : ce que tu veux du travail (par exemple une condition, une manière de travailler, une valeur)', 'aria-label': 'Ce que je veux du travail' });
    var message = h('p', { class: 'note', role: 'status' });
    var liste = sortie('div', function (e) {
      if (!gardees.length) e.appendChild(h('p', { class: 'vide' }, 'Rien de gardé pour l\'instant dans cette famille.'));
      gardees.forEach(function (l) { e.appendChild(carteLigne(l, boutonsLigne(l))); });
    }, { class: 'cartes' });
    return bloc('Ce que je veux du travail', 'I2', h('div', { class: 'cartes' },
      note('Des phrases proposées avec leur source, que tu valides, plus une famille à part : ce que tu veux du travail. Ce que tu écris ici a pour source « toi » et le jour.'),
      h('label', null, 'Écrire une ligne', zone),
      h('button', { class: 'action', type: 'button', onclick: function () {
        var l = M.ligneSaisie('veux', zone.value, aujourdhui());
        if (!l) { message.textContent = 'Écris au moins quelques mots.'; return; }
        var f = M.fusionnerRecolte(etat.recolte.lignes, [l]);
        etat.recolte.lignes = f.lignes; sauver(); afficher(true);
      } }, 'Ajouter à ce que je veux'),
      message,
      aRelire.length ? h('p', { class: 'note' }, aRelire.length + ' ligne(s) de cette famille attendent ta relecture. ',
        h('button', { class: 'discret', type: 'button', onclick: function () { ui.recolte.etat = 'propose'; ui.recolte.famille = 'veux'; ui.sous.recolte = 'relire'; afficher(false); } }, 'Les relire')) : null,
      h('h3', null, 'Gardé (' + gardees.length + ')'), liste));
  }
  function ongletEliminer() {
    var elims = M.eliminations(etat.recolte.lignes);
    var pistesNoms = pistesVives().map(function (p) { return { id: p.id, nom: p.nom, resume: p.resume }; });
    var proches = M.recoupements(elims, pistesNoms);
    var liste = sortie('div', function (e) {
      if (!elims.length) e.appendChild(h('p', { class: 'vide' }, 'Rien d\'écarté pour l\'instant. Chaque ligne que tu écartes, et chaque refus que tu gardes, apparaît ici avec sa source.'));
      elims.forEach(function (l) { e.appendChild(carteLigne(l, boutonsLigne(l))); });
    }, { class: 'cartes' });
    var rapproche = proches.length
      ? h('div', { class: 'cartes' }, proches.map(function (p) {
        return h('article', { class: 'carte' }, h('h3', null, p.nom),
          h('ul', { class: 'sources' }, p.recoupes.slice(0, 4).map(function (r) { return h('li', null, '« ' + r.ligne.texte + ' » · mots en commun : ' + r.mots.join(', ')); })),
          h('button', { class: 'discret', type: 'button', onclick: function () { aller('pistes'); } }, 'Ouvrir les pistes'));
      }))
      : h('p', { class: 'vide' }, 'Aucune piste ne partage de mots avec ce que tu as écarté.');
    return bloc('Ce que tu ne veux pas', 'I64', h('div', { class: 'cartes' },
      note('Le métier se déduit aussi par élimination. Voici ce que tu as écarté ou refusé, chaque fois avec sa source. Les pistes plus bas partagent des mots avec ces lignes : c\'est un rapprochement, pas un verdict, et rien n\'est éliminé à ta place.'),
      h('h3', null, 'Ce que tu as écarté (' + elims.length + ')'), liste,
      h('h3', null, 'Pistes qui ressemblent à ce que tu as écarté'), rapproche));
  }
  function ecranRecolte(racine) {
    racine.appendChild(sousOnglets('recolte', [['relire', 'À relire'], ['veux', 'Ce que je veux du travail'], ['eliminer', 'Ce que tu ne veux pas']],
      { relire: ongletRelire, veux: ongletVeux, eliminer: ongletEliminer }));
  }

  /* ---------- 1. Cahier des charges ---------- */
  function ecranCahier(racine) {
    var c = ['cahier'];
    racine.appendChild(h('div', { class: 'cartes' },
      bloc('Tes critères', 'I15 I88 I122', h('div', { class: 'cartes' },
        note('À remplir selon ta situation : rien n\'est imposé, et les deux chiffres ci-dessous sont facultatifs. Laisse vide ce que tu ne sais pas.'),
        grille(
          champ('Revenu', liant(c.concat('revenu'))),
          champ('Revenu visé (€ par an, facultatif)', liant(c.concat('revenuVise'), { type: 'number', min: 0 })),
          champ('Heures', liant(c.concat('heures'))),
          champ('Plafond d\'heures par semaine (facultatif)', liant(c.concat('plafondHeures'), { type: 'number', min: 0 })),
          champ('Lieu', liant(c.concat('lieu'))),
          champ('Avec', liant(c.concat('statut'))),
          champ('Mois sans revenu au maximum', liant(c.concat('marge'), { type: 'number', min: 0 })),
          champ('Le temps libre va à', liant(c.concat('tempsLibre'))),
          champ('Le métier doit', liant(c.concat('doit')))),
        grille(
          champ('Autonomie voulue', liant(c.concat('autonomie'), { type: 'textarea', rows: 2 })),
          champ('Projet de vie à faire entrer dans le calendrier (à toi de le nommer)', liant(c.concat('projetVie'), { type: 'textarea', rows: 2 }))))),

      bloc('Réglages de calcul', 'I86', h('div', { class: 'cartes' },
        note('Deux hypothèses du compteur. Elles ne viennent d\'aucune mesure : remplace-les par les tiennes.'),
        grille(
          champ('Heures par journée facturée', liant(c.concat('reglages', 'heuresParJour'), { type: 'number', min: 0, supp: !etat.cahier.reglages || M.nombre(etat.cahier.reglages.heuresParJour) === M.REGLAGES_DEFAUT.heuresParJour })),
          champ('Semaines travaillées par an', liant(c.concat('reglages', 'semainesAn'), { type: 'number', min: 1, supp: !etat.cahier.reglages || M.nombre(etat.cahier.reglages.semainesAn) === M.REGLAGES_DEFAUT.semainesAn }))),
        note('45 semaines et 7 heures par journée sont des hypothèses de départ (supposé) : remplace-les par tes mesures.'))),

      bloc('Quatre questions', 'I16 I17 I33 I34', h('div', { class: 'cartes' },
        ['I16', 'I17', 'I33', 'I34'].map(function (id) {
          var q = D.QUESTIONS[id];
          var ch = champ(q.titre + ' — ' + q.texte, liant(c.concat('reponses', id), { type: 'textarea', rows: id === 'I34' ? 6 : 3 }));
          return id === 'I17' ? h('div', { class: 'cartes', 'data-idee': 'I17' }, ch, h('p', { class: 'note' }, 'Rien n\'est envoyé d\'ici, ton texte reste sur cet appareil.')) : ch;
        }))),

      bloc('Le nom du métier', 'I35', h('div', { class: 'cartes' },
        note('Écris le titre, comme sur une carte de visite. Puis dis-le à voix haute.'),
        grille(
          champ('Titre', liant(c.concat('titre', 'texte'))),
          champ('Dit à voix haute le', liant(c.concat('titre', 'date'), { type: 'date' }))),
        champ('Je l\'ai dit à voix haute', liant(c.concat('titre', 'ditAVoixHaute'), { type: 'checkbox' })))),

      bloc('Trois colonnes', 'I76', h('div', { class: 'cartes' },
        note('Une heure, une feuille : ce que j\'aime, ce que je sais faire, ce qui se paie. Une idée par ligne.'),
        grille(
          champ('Ce que j\'aime', liant(c.concat('troisColonnes', 'aime'), { type: 'textarea', rows: 7 })),
          champ('Ce que je sais faire', liant(c.concat('troisColonnes', 'sais'), { type: 'textarea', rows: 7 })),
          champ('Ce qui se paie', liant(c.concat('troisColonnes', 'paie'), { type: 'textarea', rows: 7 }))))),

      bloc('Tes cinq missions les mieux payées à l\'heure', 'I123', missionsTableau())));
  }

  function missionsTableau() {
    var c = ['cahier', 'missions'];
    var corps = h('tbody');
    etat.cahier.missions.forEach(function (m, i) {
      corps.appendChild(h('tr', null,
        h('td', null, saisie(liant(c.concat(i, 'nom'), { label: 'Mission ' + (i + 1) }))),
        h('td', null, saisie(liant(c.concat(i, 'valeur'), { type: 'number', min: 0, label: 'Valeur en euros, mission ' + (i + 1) }))),
        h('td', null, saisie(liant(c.concat(i, 'heures'), { type: 'number', min: 0, label: 'Heures, mission ' + (i + 1) }))),
        h('td', { class: 'n' }, sortie('span', function (el) {
          var r = M.tauxMissions(etat.cahier.missions)[i];
          el.textContent = r.eurosHeure === null ? '—' : fr(r.eurosHeure, 1) + ' €/h';
        }))));
    });
    return h('div', { class: 'cartes' },
      note('Une heure : liste cinq missions passées, avec ce qu\'elles ont rapporté (ou ce qu\'elles auraient valu) et les heures réellement passées, invisibles comprises.'),
      h('div', { class: 'tableau' }, h('table', null,
        h('thead', null, h('tr', null, h('th', null, 'Mission'), h('th', null, 'Valeur (€)'), h('th', null, 'Heures'), h('th', null, '€ par heure'))), corps)));
  }

  /* ---------- 2. Compteur ---------- */
  function sparkline(valeurs) {
    var ns = 'http://www.w3.org/2000/svg', max = 0;
    valeurs.forEach(function (v) { if (v > max) max = v; });
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 132 40'); svg.setAttribute('width', '132'); svg.setAttribute('height', '40'); svg.setAttribute('role', 'img');
    var sans = valeurs.filter(function (v) { return v === 0; }).length;
    svg.setAttribute('aria-label', 'Revenu des 12 premiers mois : ' + sans + ' mois sans revenu avant le retour');
    valeurs.forEach(function (v, i) {
      var r = document.createElementNS(ns, 'rect'), hh = max > 0 ? Math.max(2, 34 * v / max) : 2;
      r.setAttribute('x', 2 + i * 11); r.setAttribute('width', 9); r.setAttribute('y', 37 - hh); r.setAttribute('height', hh);
      r.setAttribute('fill', v === 0 ? 'var(--neutre)' : 'var(--plein)'); r.setAttribute('opacity', v === 0 ? '.45' : '1');
      svg.appendChild(r);
    });
    return svg;
  }

  function carteCompteur(l, rang) {
    var p = l.piste, c = l.chiffres, g = reglages();
    var f = formeDistance(p.distance), natureTxt;
    if (!c.revenu) natureTxt = null;
    else if (c.revenu.nature === 'brut') natureTxt = 'brut salarié';
    else natureTxt = c.revenu.chargesPrises ? 'chiffre d\'affaires après charges' : 'chiffre d\'affaires, avant charges et impôts';
    var manque = [];
    if (!c.revenu) manque.push('tarif ou revenu');
    if (c.heuresVisibles === null) manque.push('jours par semaine');
    var besoin = M.heuresPourBesoin(c, besoinAnnuel(), g.semainesAn);
    var courbe = M.courbeRevenus(p, g, scenario(), 12);
    var mois = M.nombre(p.moisSansRevenu);
    var dd = p.droitEntree || {};
    return h('article', { class: 'carte', 'data-idee': 'I84 I87 I114 I116 I117' },
      h('div', { class: 'rang' }, rang !== null ? puce('n° ' + rang, 'ok') : null, h('h3', null, p.nom), puce(p.idee, 'neutre'),
        natureTxt ? puce(natureTxt, c.revenu.nature === 'brut' ? 'ex' : 'neutre') : null,
        M.auDelaMarge(p, marge()) ? puce('au-delà de ta marge', 'non') : null,
        M.auDessusPlafond(c, etat.cahier.plafondHeures) ? puce('au-dessus du plafond d\'heures', 'ex') : null),
      h('div', { class: 'rang' },
        h('span', { class: 'gros' }, c.eurosHeureVie === null ? '—' : fr(c.eurosHeureVie, 1) + ' € par heure de vie'),
        c.eurosHeureVie !== null && !c.invisiblesRenseignees ? puce('heures invisibles non renseignées', 'ex') : null),
      h('dl', { class: 'chiffres' },
        dt('Taux atteint', c.tauxAtteint === null ? '—' : fr(c.tauxAtteint, 1) + ' €/h facturée'),
        dt('Revenu par an', c.revenu ? eur(c.revenu.apresCharges) : '—'),
        dt('Heures visibles / sem.', c.heuresVisibles === null ? '—' : fr(c.heuresVisibles, 1)),
        dt('Heures invisibles / sem.', c.invisiblesRenseignees ? fr(c.heuresInvisibles, 1) : 'non renseignées'),
        dt('Distance', f[0] + nomOption(D.DISTANCES, p.distance || 'inconnue')),
        dt('Urgences subies', (p.chantier === 'oui' || p.chantier === 'possible' ? 'chantier ' + (p.chantier === 'oui' ? '' : 'possible ') + '· ' : '') + nomOption(D.URGENCES, p.urgences || 'inconnu')),
        dt('Droit d\'entrée', (dd.mois === null || dd.mois === undefined) && (dd.euros === null || dd.euros === undefined) ? (dd.note || 'à établir') : fr(M.nombre(dd.mois), 0) + ' mois · ' + eur(M.nombre(dd.euros))),
        dt('Mois sans revenu', mois === null ? 'pas encore établi' : fr(mois, 0) + (M.auDelaMarge(p, marge()) ? ' · au-delà de ta marge' : ''), p.supposes.indexOf('moisSansRevenu') >= 0),
        besoin !== null ? dt('Heures par semaine pour ton besoin', fr(besoin, 1)) : null),
      courbe ? h('div', null, sparkline(courbe), h('span', { class: 'note' }, ' douze premiers mois')) : null,
      manque.length ? h('p', { class: 'vide' }, 'Pas encore chiffrée : il manque ' + manque.join(' et ') + '.') : null,
      h('div', { class: 'rang' }, h('button', { class: 'discret', type: 'button', onclick: function () { ui.ouvrir = p.id; ui.sous.pistes = 'fiches'; aller('pistes'); } }, 'Ouvrir la fiche')));
  }
  function dt(titre, valeur, supp) { return h('div', null, h('dt', null, titre), h('dd', null, valeur, supp ? ' ' : '', supp ? SUPPOSE() : null)); }

  function ecranCompteur(racine) {
    var c = ['compteur'];
    var classement = sortie('div', function (el) {
      var lignes = M.classer(pistesVives(), reglages(), scenario(), etat.compteur.tri, etat.cahier.plafondHeures);
      var elim = pistes().length - lignes.length;
      var groupes = [[0, null], [1, 'Au-dessus de ton plafond d\'heures'], [2, 'Pas encore chiffrées']];
      groupes.forEach(function (gr) {
        var ll = lignes.filter(function (l) { return l.groupe === gr[0]; });
        if (!ll.length) return;
        if (gr[1]) el.appendChild(h('h3', null, gr[1] + ' (' + ll.length + ')'));
        ll.forEach(function (l) { el.appendChild(carteCompteur(l, l.rang)); });
      });
      if (elim) el.appendChild(note(elim + ' hypothèse(s) éliminée(s) ne figure(nt) pas ici (onglet Pistes).'));
    }, { class: 'cartes' });
    var besoinSortie = sortie('p', function (el) {
      var b = besoinAnnuel();
      el.className = 'note';
      el.textContent = b === null ? 'Renseigne ton besoin mensuel pour voir, sur chaque piste, les heures qu\'il demande.' : 'Besoin annuel : ' + eur(b) + '. Baisser le besoin libère autant d\'heures qu\'augmenter le revenu.';
    });
    racine.appendChild(h('div', { class: 'cartes' },
      bloc('Le compteur', 'I84 I85 I86 I87 I88 I89', h('div', { class: 'cartes' },
        note('Pour chaque piste : le taux atteint (euros par heure facturée), puis les euros par heure de VIE, heures invisibles comprises (prospection, devis, administration, trajets, relances, charge mentale). Aucun objectif n\'est imposé : le classement montre ce qui est atteint.'),
        grille(
          champ('Chiffrer avec le tarif', liant(c.concat('scenario'), { type: 'select', options: [['bas', 'bas (prudent)'], ['haut', 'haut']] })),
          champ('Classer par', liant(c.concat('tri'), { type: 'select', options: [['vie', 'euros par heure de vie'], ['taux', 'taux atteint'], ['revenu', 'revenu par an']] })),
          champ('Ce qu\'il te faut par mois (€)', liant(c.concat('besoinMensuel'), { type: 'number', min: 0 }))),
        besoinSortie,
        sortie('div', function (el) {
          var p = M.montantCoutVie(etat.recolte.lignes);
          if (!p || p.montant === null) { el.appendChild(h('p', { class: 'note', 'data-idee': 'I85' }, 'Le coût réel de ta vie peut être proposé par la récolte (abonnements, budget, charges) : garde la ligne « Coût réel de ta vie… » dans l\'écran « Ce que tu t\'es déjà dit ».')); return; }
          el.appendChild(h('div', { class: 'carte', 'data-idee': 'I85' },
            h('p', null, 'La récolte propose : ', h('strong', null, fr(p.montant, 2) + ' € par mois'), ' (ligne que tu as gardée).'),
            h('p', { class: 'note' }, 'Source : ' + p.ligne.source),
            h('button', { class: 'discret', type: 'button', onclick: function () { etat.compteur.besoinMensuel = p.montant; sauver(); afficher(true); } }, 'Reprendre ce montant comme « ce qu\'il te faut par mois »')));
        }),
        note('Le chiffre d\'affaires hors taxes n\'est pas un revenu : charges, impôts et assurance en moins. Renseigne le pourcentage de charges dans la fiche pour le prendre en compte. Le brut salarié et le chiffre d\'affaires ne sont pas comparables.'))),
      classement,
      reconversion()));
  }

  function reconversion() {
    var c = ['compteur', 'reconversion'];
    var r = sortie('div', function (el) {
      var x = M.chiffrageReconversion({ coutFormation: etat.compteur.reconversion.coutFormation, moisSansRevenu: etat.compteur.reconversion.moisSansRevenu,
        revenuMensuelPerdu: etat.compteur.reconversion.revenuMensuelPerdu, patrimoine: etat.compteur.reconversion.patrimoine, coutVieMensuel: etat.compteur.besoinMensuel });
      el.appendChild(h('dl', { class: 'chiffres' },
        dt('Revenus perdus', eur(x.revenusPerdus)), dt('Coût total', eur(x.total)), dt('Reste à financer', eur(x.resteAFinancer)),
        dt('Mois tenables avec ce patrimoine', x.moisTenables === null ? '—' : fr(x.moisTenables, 1))));
    });
    return bloc('Chiffrer une reconversion', 'I50', h('div', { class: 'cartes' },
      note('Coût des études, revenus perdus, ce que le patrimoine rend possible. Les mois tenables utilisent « ce qu\'il te faut par mois » ci-dessus.'),
      grille(
        champ('Coût des études ou de la formation (€)', liant(c.concat('coutFormation'), { type: 'number', min: 0 })),
        champ('Mois sans revenu', liant(c.concat('moisSansRevenu'), { type: 'number', min: 0 })),
        champ('Revenu mensuel perdu pendant ce temps (€)', liant(c.concat('revenuMensuelPerdu'), { type: 'number', min: 0 })),
        champ('Patrimoine mobilisable (€)', liant(c.concat('patrimoine'), { type: 'number', min: 0 }))),
      champ('Effet sur la retraite (note libre)', liant(c.concat('retraite'), { type: 'textarea', rows: 2 })), r,
      questionConseillere()));
  }

  /* I50 : une question prête pour un·e conseiller·ère financier·ère ; rien n'est envoyé d'ici : tu la copies et tu la poses toi-même */
  function questionConseillere() {
    var zone = sortie('textarea', function (el) {
      el.value = M.questionConseillereFinances(etat.compteur.reconversion, etat.compteur.besoinMensuel, !!ui.avecPatrimoine);
    }, { rows: 10, readonly: true, 'aria-label': 'Question prête pour un conseiller financier' });
    var message = h('p', { class: 'note', role: 'status' });
    var coche = h('input', { type: 'checkbox', onchange: function (e) { ui.avecPatrimoine = e.target.checked; rafraichir(); } });
    coche.checked = !!ui.avecPatrimoine;
    return h('div', { class: 'carte', 'data-idee': 'I50' },
      h('h3', null, 'Question prête pour un conseiller financier'),
      note('Un texte construit avec les chiffres ci-dessus. Il n\'est pas envoyé : copie-le, puis pose-le toi-même à la personne de ton choix. Le patrimoine n\'y entre que si tu le coches.'),
      h('label', { class: 'ligne' }, coche, ' Inclure mon patrimoine mobilisable dans la question'),
      zone,
      h('button', { class: 'action', type: 'button', onclick: function () {
        var texte = zone.value;
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(texte).then(function () { message.textContent = 'Copiée.'; }, function () { zone.select(); message.textContent = 'Copie refusée : le texte est sélectionné, copie-le à la main.'; }); return; }
        } catch (e) { /* repli ci-dessous */ }
        zone.select(); message.textContent = 'Le texte est sélectionné : copie-le à la main.';
      } }, 'Copier la question'),
      message);
  }

  /* ---------- 3. Pistes ---------- */
  function ecranPistes(racine) {
    racine.appendChild(sousOnglets('pistes', [['fiches', 'Fiches'], ['galerie', 'Galerie de parcours'], ['generateur', 'Générateur et croisements'], ['bouquet', 'Bouquet'], ['eliminees', 'Hypothèses éliminées']],
      { fiches: onglerFiches, galerie: ongletGalerie, generateur: ongletGenerateur, bouquet: ongletBouquet, eliminees: ongletEliminees }));
  }

  /* I24 : parcours publics, lus et non contactés */
  function ongletGalerie() {
    var E = typeof MetierEnquete !== 'undefined' ? MetierEnquete : null;
    if (!E) return h('p', { class: 'vide' }, 'La galerie n\'est pas chargée.');
    return h('div', { class: 'cartes' },
      bloc('Galerie de parcours publiés', 'I24', h('div', { class: 'cartes' },
        note('Des informations professionnelles publiées par les personnes elles-mêmes (ou leur entreprise), avec le lien vers la source. Aucune prise de contact, aucun réseau social. Ce que la source ne dit pas est écrit « non indiqué » : aucune ligne ne chiffre les heures par semaine.'),
        note(E.PARCOURS.length + ' parcours. Un seul dit travailler surtout à distance. Aucun ne publie ses heures ni ses revenus.'))),
      E.PARCOURS.map(function (x) {
        return h('details', { class: 'carte', 'data-idee': 'I24' },
          h('summary', null, h('strong', null, x.nom), ' · ', x.metier, ' ', puce(x.pertinence, x.pertinence === 'forte' ? 'ok' : 'neutre')),
          h('p', null, x.dit),
          h('dl', { class: 'chiffres' },
            h('dt', null, 'Distance'), h('dd', null, x.distance), h('dt', null, 'Heures'), h('dd', null, x.heures), h('dt', null, 'Tarif'), h('dd', null, x.tarif)),
          h('p', { class: 'note' }, 'Limite : ' + x.limite),
          h('p', { class: 'note' }, h('a', { href: x.source.url, target: '_blank', rel: 'noopener noreferrer' }, x.source.texte), ' · consultée le ' + x.source.date));
      }));
  }

  function optionsDe(liste) { return liste.map(function (x) { return [x.id, x.nom]; }); }
  function pc(p, champ_, type, extra) {
    var o = { type: type || 'number', get: function () { var q = piste(p.id); return q ? q[champ_] : null; },
      set: function (v) { fixer(['pistes', p.id, champ_], v); }, supp: p.supposes.indexOf(champ_) >= 0 };
    for (var k in (extra || {})) o[k] = extra[k];
    return o;
  }
  function listeSources(p) {
    return h('ul', { class: 'sources' }, (p.sources || []).map(function (s) {
      var etiq = (s.nature && typeof MetierEnquete !== 'undefined' ? ' · ' + (MetierEnquete.NATURES[s.nature] || s.nature) : '') +
        (s.date ? ' · consultée le ' + s.date : '') + (s.nature && s.ouverte === false ? ' · page non ouverte' : '');
      return h('li', null, s.url ? h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, s.texte) : s.texte, etiq ? h('span', { class: 'note' }, etiq) : null);
    }));
  }
  function ficheComplete(p0) {
    var p = p0;
    var det = h('details', { class: 'carte' + (p.statut === 'elimine' ? ' ecartee' : ''), 'data-idee': p.idee.indexOf('I') === 0 ? p.idee : null, 'data-piste': p.id },
      h('summary', null, p.nom, ' ', puce(p.idee, 'neutre'), ' ', p.statut === 'hypothese' ? puce('hypothèse gardée', 'ok') : p.statut === 'elimine' ? puce('éliminée', 'non') : null));
    if (ui.ouvrir === p.id) det.setAttribute('open', '');
    det.addEventListener('toggle', function () { if (det.open) ui.ouvrir = p.id; });
    var corps = h('div', { class: 'cartes' });
    corps.appendChild(h('p', null, p.resume || ''));
    if (p.voisine) corps.appendChild(note('Voisine de : ' + p.voisine));
    corps.appendChild(sortie('div', function (el) {
      var g = reglages(), b = M.chiffrer(p0 && piste(p.id), g, 'bas'), hh = M.chiffrer(piste(p.id), g, 'haut');
      el.appendChild(h('dl', { class: 'chiffres' },
        dt('€ par heure de vie (bas)', b.eurosHeureVie === null ? '—' : fr(b.eurosHeureVie, 1)),
        dt('€ par heure de vie (haut)', hh.eurosHeureVie === null ? '—' : fr(hh.eurosHeureVie, 1)),
        dt('Taux atteint (bas)', b.tauxAtteint === null ? '—' : fr(b.tauxAtteint, 1)),
        dt('Revenu par an (bas → haut)', (b.revenu ? eur(b.revenu.apresCharges) : '—') + ' → ' + (hh.revenu ? eur(hh.revenu.apresCharges) : '—'))));
    }));
    corps.appendChild(grille(
      champ('Statut de la piste', pc(p, 'statut', 'select', { options: [['a_explorer', 'À explorer'], ['hypothese', 'Hypothèse gardée'], ['elimine', 'Éliminée']],
        set: function (v) { fixer(['pistes', p.id, 'statut'], v); if (v === 'elimine' && !piste(p.id).dateElimination) fixer(['pistes', p.id, 'dateElimination'], aujourdhui()); ui.ouvrir = p.id; afficher(true); } })),
      champ('Étape du patron', pc(p, 'patron', 'select', { options: optionsDe(D.ETAPES_PATRON) })),
      champ('Nature du chiffre', pc(p, 'nature', 'select', { options: [['ca', 'Chiffre d\'affaires (avant charges)'], ['brut', 'Salaire brut']] }))));
    corps.appendChild(h('h3', null, 'Chiffres du compteur'));
    corps.appendChild(grille(
      champ('Tarif bas (€ par jour)', pc(p, 'tarifBas', 'number', { min: 0 })), champ('Tarif haut (€ par jour)', pc(p, 'tarifHaut', 'number', { min: 0 })),
      champ('Revenu direct bas (€ par an)', pc(p, 'revenuBas', 'number', { min: 0 })), champ('Revenu direct haut (€ par an)', pc(p, 'revenuHaut', 'number', { min: 0 })),
      champ('Jours par semaine', pc(p, 'joursSemaine', 'number', { min: 0 })), champ('Semaines par an (sinon : réglage)', pc(p, 'semainesAn', 'number', { min: 1 })),
      champ('Heures facturées / sem. (sinon : jours × heures)', pc(p, 'heuresVisSemaine', 'number', { min: 0 })), champ('Charges et impôts (% du chiffre d\'affaires)', pc(p, 'chargesPct', 'number', { min: 0 }))));
    corps.appendChild(h('h3', null, 'Heures invisibles par semaine'));
    var inv = { prospection: 'Prospection', devis: 'Devis', admin: 'Administration', trajets: 'Trajets', relances: 'Relances', chargeMentale: 'Charge mentale' };
    corps.appendChild(grille(M.CHAMPS_INVISIBLES.map(function (k) {
      return champ(inv[k], { type: 'number', min: 0, get: function () { return (piste(p.id).heuresInv || {})[k]; }, set: function (v) { fixer(['pistes', p.id, 'heuresInv', k], v); } });
    })));
    corps.appendChild(h('h3', null, 'Ce qui peut casser'));
    corps.appendChild(grille(
      champ('Distance', pc(p, 'distance', 'select', { options: optionsDe(D.DISTANCES) })),
      champ('Urgences subies', pc(p, 'urgences', 'select', { options: optionsDe(D.URGENCES) })),
      champ('Chantier', pc(p, 'chantier', 'select', { options: [['', 'Pas encore établi'], ['non', 'Non'], ['possible', 'Possible'], ['oui', 'Oui']] })),
      champ('Mois sans revenu avant le retour', pc(p, 'moisSansRevenu', 'number', { min: 0 })),
      champ('Heures plafonnables', pc(p, 'plafonnable', 'select', { options: [['', 'Pas encore établi'], ['oui', 'Oui'], ['non', 'Non']] })),
      champ('Possibilité de s\'arrêter', pc(p, 'arreter', 'select', { options: [['', 'Pas encore établi'], ['oui', 'Oui'], ['non', 'Non']] }))));
    var de = function (k) { return { type: k === 'note' ? 'text' : 'number', min: 0, supp: p.supposes.indexOf('droitEntree') >= 0 && k === 'note',
      get: function () { return (piste(p.id).droitEntree || {})[k]; }, set: function (v) { fixer(['pistes', p.id, 'droitEntree', k], v); } }; };
    corps.appendChild(grille(champ('Droit d\'entrée : mois', de('mois')), champ('Droit d\'entrée : euros', de('euros')), champ('Droit d\'entrée : à quoi', de('note'))));
    corps.appendChild(champ('Responsabilité : ce qu\'il faut assurer, signer, déclarer', pc(p, 'responsabilite', 'textarea', { rows: 2 })));
    corps.appendChild(grille(champ('Délai d\'accès', pc(p, 'delai', 'text')), champ('Ce qui manque', pc(p, 'manque', 'text'))));
    corps.appendChild(champ('Notes', pc(p, 'notes', 'textarea', { rows: 3 })));
    corps.appendChild(h('h3', null, 'Diagnostic différentiel'));
    corps.appendChild(note('Pour garder cinq hypothèses au plus : l\'examen qui éliminerait celle-ci, puis ce que l\'examen a montré.'));
    corps.appendChild(grille(
      champ('L\'examen qui l\'éliminerait', pc(p, 'examen', 'textarea', { rows: 2 })),
      champ('Ce que l\'examen a montré', pc(p, 'resultatExamen', 'textarea', { rows: 2 }))));
    if (p.sources && p.sources.length) {
      corps.appendChild(h('h3', null, 'Sources'));
      corps.appendChild(listeSources(p));
    }
    var boutons = h('div', { class: 'rang' },
      h('button', { class: 'discret', type: 'button', onclick: function () { ui.carnetPiste = p.id; ui.sous.tests = 'carnet'; aller('tests'); } }, 'Carnet de bord'));
    if (p.id.indexOf('perso-') === 0) {
      boutons.appendChild(h('button', { class: 'discret', type: 'button', onclick: function () {
        if (!confirm('Supprimer cette piste ?')) return;
        etat.pistesPerso = etat.pistesPerso.filter(function (x) { return x.id !== p.id; }); delete etat.pistes[p.id]; sauver(); afficher(true);
      } }, 'Supprimer cette piste'));
    }
    corps.appendChild(boutons);
    det.appendChild(corps);
    return det;
  }

  function onglerFiches() {
    var haut = h('div', { class: 'cartes' });
    var liste = h('div', { class: 'cartes' });
    function monter() {
      liste.textContent = '';
      var tous = pistes();
      Object.keys(D.GROUPES).forEach(function (gid) {
        var gp = tous.filter(function (p) { return p.groupe === gid && p.statut !== 'elimine' && (ui.filtre === 'tous' || p.statut === ui.filtre); });
        if (!gp.length) return;
        liste.appendChild(h('h3', null, D.GROUPES[gid] + ' (' + gp.length + ')'));
        gp.forEach(function (p) { liste.appendChild(ficheComplete(p)); });
      });
    }
    var nbHyp = pistes().filter(function (p) { return p.statut === 'hypothese'; }).length;
    haut.appendChild(bloc('Fiches de pistes', 'I90 I91 I92 I93 I94 I95 I96 I97 I98 I99 I100 I102 I103 I104 I105 I106 I107 I108 I109 I110 I111 I112 I114 I115 I116 I117 I25 I37', h('div', { class: 'cartes' },
      note('Une fiche par piste : ce sont des pistes à étudier, pas des activités lancées. Les chiffres portent leur source ; ce qui n\'a pas de source est « supposé » ou vide. Ouvre une fiche pour la compléter.'),
      note('Hypothèses gardées : ' + nbHyp + ' (cinq au plus pour un diagnostic net). Les hypothèses éliminées sont dans l\'onglet voisin.'),
      grille(champ('Afficher', { type: 'select', options: [['tous', 'Toutes les pistes'], ['a_explorer', 'À explorer'], ['hypothese', 'Hypothèses gardées']], get: function () { return ui.filtre; },
        set: function (v) { ui.filtre = v; monter(); } })),
      ajoutPiste())));
    if (typeof MetierEnquete !== 'undefined') {
      haut.appendChild(bloc('Écartés de l\'enquête : ce ne sont pas des métiers', 'I21', h('div', { class: 'cartes' },
        note('Les activités d\'investissement et les pièges à éviter ne sont ni classés ni recommandés. Aucun conseil de placement.'),
        h('ul', { class: 'sources' }, MetierEnquete.ECARTES.map(function (e) { return h('li', null, h('strong', null, e.nom), ' : ', e.raison, h('span', { class: 'note' }, ' · ' + e.source)); })))));
    }
    haut.appendChild(liste);
    monter();
    return haut;
  }

  function ajoutPiste() {
    var champNom = h('input', { type: 'text', placeholder: 'Nom de la nouvelle piste', 'aria-label': 'Nom de la nouvelle piste' });
    return h('div', { class: 'rang' }, champNom, h('button', { class: 'action', type: 'button', onclick: function () {
      var n = champNom.value.trim(); if (!n) return;
      creerPiste(n, ''); ui.sous.pistes = 'fiches'; afficher(true);
    } }, 'Ajouter une piste'));
  }
  function creerPiste(nom, resume) {
    var max = 0;
    etat.pistesPerso.forEach(function (x) { var n = parseInt(x.id.replace('perso-', ''), 10); if (n > max) max = n; });
    var f = D.nouvelle('perso-' + (max + 1), nom); f.resume = resume || '';
    etat.pistesPerso.push(f); sauver();
    ui.ouvrir = f.id;
    return f;
  }

  function lignes(texte) { return String(texte || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean); }

  function ongletGenerateur() {
    var c = ['generateur'];
    var cartes = sortie('div', function (el) {
      var combos = M.combinaisonsGenerateur(lignes(etat.generateur.qui), lignes(etat.generateur.quoi), lignes(etat.generateur.melange));
      if (!combos.length) { el.appendChild(h('p', { class: 'vide' }, 'Remplis au moins une ligne dans chaque case pour voir les cartes.')); return; }
      if (ui.carteIdx >= combos.length) ui.carteIdx = 0;
      var k = combos[ui.carteIdx];
      el.appendChild(h('div', { class: 'carte' }, h('p', { class: 'gros' }, k.phrase), h('p', { class: 'note' }, 'Carte ' + (ui.carteIdx + 1) + ' sur ' + combos.length + (combos.length > 100 ? ' (une centaine à balayer, le reste existe encore)' : '')),
        h('div', { class: 'rang' },
          h('button', { class: 'discret', type: 'button', onclick: function () { ui.carteIdx = (ui.carteIdx - 1 + combos.length) % combos.length; rafraichir(); } }, '◀ Précédente'),
          h('button', { class: 'discret', type: 'button', onclick: function () { ui.carteIdx = (ui.carteIdx + 1) % combos.length; rafraichir(); } }, 'Suivante ▶'),
          h('button', { class: 'action', type: 'button', onclick: function () { creerPiste(k.phrase, 'Née du générateur : ' + k.qui + ' / ' + k.quoi + ' / ' + k.melange); alert('Piste ajoutée dans la liste des fiches.'); } }, 'Garder comme piste'))));
    });
    var greffes = sortie('div', function (el) {
      var paires = M.croiser(lignes(etat.generateur.portes), lignes(etat.generateur.greffons));
      if (!paires.length) { el.appendChild(h('p', { class: 'vide' }, 'Écris au moins une activité dans chaque case pour voir les croisements.')); return; }
      el.appendChild(note(paires.length + ' croisement(s)' + (paires.length > 40 ? ' (40 affichés)' : '') + '.'));
      paires.slice(0, 40).forEach(function (x) {
        var nom = x.porteGreffe + ' × ' + x.greffon;
        el.appendChild(h('div', { class: 'rang' }, h('span', null, nom),
          h('button', { class: 'discret', type: 'button', onclick: function () { creerPiste(nom, 'Greffe : porte-greffe « ' + x.porteGreffe + ' », greffon « ' + x.greffon + ' ».'); alert('Piste ajoutée dans la liste des fiches.'); } }, 'Garder')));
      });
    }, { class: 'cartes' });
    var patrons = sortie('div', function (el) {
      var en = pistes().filter(function (p) { return p.patron && p.patron !== 'aucune'; });
      if (!en.length) { el.appendChild(h('p', { class: 'vide' }, 'Aucune piste n\'a encore de patron. Choisis une étape dans sa fiche.')); return; }
      en.forEach(function (p) { el.appendChild(h('div', { class: 'rang' }, h('span', null, p.nom), puce(nomOption(D.ETAPES_PATRON, p.patron), 'neutre'))); });
    }, { class: 'cartes' });
    return h('div', { class: 'cartes' },
      bloc('Le générateur en trois cases', 'I30', h('div', { class: 'cartes' },
        note('« J\'aide [qui] à [quoi] grâce à [mon mélange] ». Une idée par ligne dans chaque case ; l\'app balaie les combinaisons comme des cartes.'),
        grille(champ('Qui', liant(c.concat('qui'), { type: 'textarea', rows: 4, placeholder: 'ex. des particuliers' })),
          champ('À quoi', liant(c.concat('quoi'), { type: 'textarea', rows: 4, placeholder: 'ex. comprendre leurs droits' })),
          champ('Grâce à (ton mélange)', liant(c.concat('melange'), { type: 'textarea', rows: 4, placeholder: 'ex. ton expérience du terrain' }))), cartes)),
      bloc('La greffe : porte-greffe et greffon', 'I28', h('div', { class: 'cartes' },
        note('Un porte-greffe solide (le métier que tu as) et un greffon (un autre domaine). L\'app croise tes activités deux à deux.'),
        grille(champ('Porte-greffes (une activité par ligne)', liant(c.concat('portes'), { type: 'textarea', rows: 4 })),
          champ('Greffons (une activité par ligne)', liant(c.concat('greffons'), { type: 'textarea', rows: 4 }))), greffes)),
      bloc('Deux métiers à inventer déjà posés', 'I29 I36', note('L\'architecte de l\'habiter et « aider d\'autres personnes à organiser leur vie » sont dans les fiches, groupe « Métiers à inventer ».')),
      bloc('Le patron avant de couper dans le tissu', 'I37', h('div', { class: 'cartes' },
        note('Pour un métier sur mesure : toile d\'essai, retouches, seconde toile, puis seulement la coupe. L\'étape se choisit dans la fiche de chaque piste.'), patrons)));
  }

  /* un choix de pistes avec jours par semaine, pour un bouquet ou une vie */
  function selecteurBouquet(parts, onChange) {
    var liste = h('div', { class: 'cartes' });
    pistesVives().forEach(function (p) {
      var part = parts[p.id] || (parts[p.id] = { pris: false, jours: '' });
      liste.appendChild(h('div', { class: 'rang' },
        h('label', { class: 'ligne' }, saisie({ type: 'checkbox', label: p.nom, get: function () { return part.pris; }, set: function (v) { part.pris = v; onChange(); } }), p.nom),
        h('label', null, saisie({ type: 'number', min: 0, label: 'Jours par semaine pour ' + p.nom, placeholder: 'jours/sem.', get: function () { return part.jours; }, set: function (v) { part.jours = v; onChange(); } }))));
    });
    return liste;
  }
  function resumeBouquet(parts) {
    var choix = pistesVives().filter(function (p) { return parts[p.id] && parts[p.id].pris; }).map(function (p) { return { piste: p, joursSemaine: parts[p.id].jours }; });
    var b = M.bouquet(choix, reglages(), scenario());
    return { b: b, n: choix.length };
  }
  function sortieBouquet(parts) {
    return sortie('div', function (el) {
      var r = resumeBouquet(parts);
      if (!r.n) { el.appendChild(h('p', { class: 'vide' }, 'Coche des pistes pour calculer la semaine.')); return; }
      el.appendChild(h('dl', { class: 'chiffres' }, dt('Revenu par an', eur(r.b.revenu)), dt('Heures par semaine', fr(r.b.heuresSemaine, 1)),
        dt('€ par heure de vie', r.b.eurosHeureVie === null ? '—' : fr(r.b.eurosHeureVie, 1))));
      if (r.b.inconnues.length) el.appendChild(note('Non comptées (pas encore chiffrées) : ' + r.b.inconnues.join(', ') + '.'));
      el.appendChild(note('Chiffré avec le tarif ' + scenario() + '.'));
    });
  }
  function ongletBouquet() {
    var parts = etat.bouquet.parts;
    return bloc('Le bouquet : plusieurs temps dans une semaine', 'I31', h('div', { class: 'cartes' },
      note('Pas un métier mais plusieurs temps (salariat, conseil, écriture…). Coche les pistes et dis combien de jours par semaine chacune prend : l\'app calcule le revenu et la semaine.'),
      sortieBouquet(parts), selecteurBouquet(parts, function () { sauver(); rafraichir(); })));
  }

  function ongletEliminees() {
    var el = sortie('div', function (e) {
      var out = pistes().filter(function (p) { return p.statut === 'elimine'; });
      if (!out.length) { e.appendChild(h('p', { class: 'vide' }, 'Aucune hypothèse éliminée pour l\'instant. Pour en éliminer une : ouvre sa fiche, écris l\'examen qui l\'élimine, puis passe son statut sur « Éliminée ».')); return; }
      out.forEach(function (p) {
        e.appendChild(h('article', { class: 'carte ecartee' }, h('h3', null, p.nom), puce(p.dateElimination ? 'éliminée le ' + p.dateElimination : 'éliminée', 'non'),
          h('p', null, h('strong', null, 'Examen : '), p.examen || '—'), h('p', null, h('strong', null, 'Ce qu\'il a montré : '), p.resultatExamen || '—'),
          h('button', { class: 'discret', type: 'button', onclick: function () { fixer(['pistes', p.id, 'statut'], 'a_explorer'); sauver(); afficher(true); } }, 'Remettre à explorer')));
      });
    }, { class: 'cartes' });
    return bloc('Hypothèses éliminées', 'I25', h('div', { class: 'cartes' }, note('Garder cinq hypothèses et chercher, pour chacune, l\'examen qui l\'élimine. Ce qu\'on élimine reste ici avec sa raison.'), el));
  }

  /* ---------- 4. Tests ---------- */
  function ecranTests(racine) {
    racine.appendChild(sousOnglets('tests', [['tests', 'Tests de deux semaines'], ['grille', 'Grille de critères'], ['carnet', 'Carnet de bord'], ['experience', 'Expérience de trois mois']],
      { tests: ongletTests, grille: ongletGrille, carnet: ongletCarnet, experience: ongletExperience }));
  }
  function optionsPistes(vide) {
    var o = vide ? [['', vide]] : [];
    return o.concat(pistesVives().map(function (p) { return [p.id, p.nom]; }));
  }

  function carteTest(t, monter) {
    var verrou = !!t.fixeLe;
    var listeSeuils = h('div', { class: 'cartes' });
    function seuils() {
      listeSeuils.textContent = '';
      t.seuils.forEach(function (s, i) {
        listeSeuils.appendChild(h('div', { class: 'carte' },
          grille(
            champ('Seuil', { type: 'text', get: function () { return s.libelle; }, set: function (v) { if (!verrou) s.libelle = v; }, placeholder: 'ex. euros par heure de vie' }),
            champ('Sens', { type: 'select', options: [['>=', 'au moins'], ['<=', 'au plus']], get: function () { return s.sens; }, set: function (v) { if (!verrou) s.sens = v; } }),
            champ('Valeur fixée avant', { type: 'number', get: function () { return s.valeur; }, set: function (v) { if (!verrou) s.valeur = v; } }),
            champ('Mesuré après', { type: 'number', get: function () { return s.mesure; }, set: function (v) { s.mesure = v; } })),
          verrou ? null : h('button', { class: 'discret', type: 'button', onclick: function () { t.seuils.splice(i, 1); sauver(); seuils(); rafraichir(); } }, 'Retirer ce seuil')));
      });
      if (!t.seuils.length) listeSeuils.appendChild(h('p', { class: 'vide' }, 'Aucun seuil : ajoute-en avant de commencer.'));
    }
    seuils();
    /* champs verrouillés : désactivés visuellement après la fixation */
    if (verrou) listeSeuils.querySelectorAll('input, select').forEach(function (e, i) { if (i % 4 !== 3) e.disabled = true; });
    var nomPiste = (piste(t.piste) || { nom: '(piste supprimée)' }).nom;
    return h('article', { class: 'carte', 'data-idee': 'I38' },
      h('h3', null, nomPiste),
      sortie('div', function (el) {
        var v = M.verdictTest(t, aujourdhui()), fin = M.finTest(t.debut), reste = fin ? M.joursEntre(aujourdhui(), fin) : null;
        el.appendChild(h('div', { class: 'rang' }, puce(v.texte, v.etat === 'atteints' ? 'ok' : v.etat === 'non_atteints' ? 'non' : 'neutre'),
          fin ? h('span', { class: 'note' }, 'du ' + t.debut + ' au ' + fin + (reste !== null ? (reste > 0 ? ' · ' + reste + ' jour(s) restant(s)' : ' · deux semaines écoulées') : '')) : null));
      }),
      grille(champ('Début du test', { type: 'date', get: function () { return t.debut; }, set: function (v) { t.debut = v; } }),
        champ('Ce que je teste', { type: 'text', get: function () { return t.objectif; }, set: function (v) { t.objectif = v; } })),
      listeSeuils,
      h('div', { class: 'rang' },
        verrou ? puce('seuils fixés le ' + t.fixeLe, 'ok') : h('button', { class: 'discret', type: 'button', onclick: function () { t.seuils.push({ libelle: '', sens: '>=', valeur: null, mesure: null }); sauver(); monter(); } }, 'Ajouter un seuil'),
        verrou ? null : h('button', { class: 'action', type: 'button', onclick: function () {
          var ok = t.seuils.length && t.seuils.every(function (s) { return s.libelle.trim() && M.nombre(s.valeur) !== null; });
          if (!ok) { alert('Chaque seuil doit avoir un nom et une valeur avant d\'être fixé.'); return; }
          if (!confirm('Fixer les seuils ? Ils ne pourront plus être changés : c\'est le but.')) return;
          t.fixeLe = aujourdhui(); sauver(); monter();
        } }, 'Fixer les seuils'),
        h('button', { class: 'discret', type: 'button', onclick: function () { if (!confirm('Supprimer ce test ?')) return; etat.tests = etat.tests.filter(function (x) { return x !== t; }); sauver(); monter(); } }, 'Supprimer ce test')));
  }

  function ongletTests() {
    var zone = h('div', { class: 'cartes' });
    var choix = { piste: '' };
    function monter() {
      zone.textContent = '';
      if (!etat.tests.length) zone.appendChild(h('p', { class: 'vide' }, 'Aucun test pour l\'instant.'));
      etat.tests.forEach(function (t) { zone.appendChild(carteTest(t, monter)); });
    }
    monter();
    return h('div', { class: 'cartes' },
      bloc('La méthode : un test, deux semaines, seuils fixés avant', 'I38', h('div', { class: 'cartes' },
        note('1. Choisis la piste. 2. Écris ce que tu testes et les seuils qui diront « ça marche » (valeurs fixées AVANT, puis verrouillées). 3. Deux semaines. 4. Saisis les mesures : le verdict se calcule seul.'),
        h('div', { class: 'rang' }, champ('Piste à tester', { type: 'select', options: optionsPistes('Choisir une piste'), get: function () { return choix.piste; }, set: function (v) { choix.piste = v; } }),
          h('button', { class: 'action', type: 'button', onclick: function () {
            if (!choix.piste) { alert('Choisis d\'abord une piste.'); return; }
            etat.tests.push({ id: 't' + Date.now(), piste: choix.piste, debut: aujourdhui(), objectif: '', seuils: [], fixeLe: '' }); sauver(); monter();
          } }, 'Nouveau test')))),
      zone);
  }

  function ongletGrille() {
    var c = ['grille', 'poids'];
    var tab = sortie('div', function (el) {
      var l = M.grille(pistesVives(), reglages(), scenario(), etat.grille.poids, marge());
      l.sort(function (a, b) { return (b.note === null ? -1 : b.note) - (a.note === null ? -1 : a.note); });
      var corps = h('tbody');
      l.forEach(function (x) {
        corps.appendChild(h('tr', null, h('td', null, x.piste.nom), h('td', { class: 'n' }, x.note === null ? '—' : x.note + ' / 100'), h('td', { class: 'n' }, x.connus + ' sur ' + x.sur)
          .cloneNode(true)));
      });
      el.appendChild(h('div', { class: 'tableau' }, h('table', null, h('thead', null, h('tr', null, h('th', null, 'Piste'), h('th', null, 'Note'), h('th', null, 'Critères connus'))), corps)));
    });
    return bloc('La grille de critères, refaite', 'I46 I89', h('div', { class: 'cartes' },
      note('Euros par heure de vie, heures plafonnables, urgences subies, possibilité de s\'arrêter, distance, marge sans revenu. Les poids de départ sont égaux : règle-les (0 retire le critère). Un critère inconnu pour une piste est laissé de côté, et la colonne « critères connus » dit sur combien la note repose.'),
      grille(M.CRITERES_GRILLE.map(function (k) { return champ(k.nom + ' — poids', liant(c.concat(k.id), { type: 'number', min: 0, step: 1 })); })),
      tab));
  }

  function ongletCarnet() {
    var zone = h('div', { class: 'cartes' });
    function monter() {
      zone.textContent = '';
      var id = ui.carnetPiste;
      if (!id) { zone.appendChild(h('p', { class: 'vide' }, 'Choisis une piste pour ouvrir son carnet.')); return; }
      if (!etat.carnets[id]) etat.carnets[id] = [];
      var entrees = etat.carnets[id];
      var nouveau = { date: aujourdhui(), type: 'preuve', texte: '' };
      zone.appendChild(sortie('p', function (el) {
        el.className = 'note';
        var d = M.derniereNouvelle(entrees), j = d ? M.joursEntre(d, aujourdhui()) : null;
        el.textContent = d ? 'Dernière nouvelle : ' + d + ' (il y a ' + j + ' jour(s)).' : 'Aucune nouvelle notée.';
      }));
      zone.appendChild(h('div', { class: 'carte' }, grille(
        champ('Date', { type: 'date', get: function () { return nouveau.date; }, set: function (v) { nouveau.date = v; } }),
        champ('Nature', { type: 'select', options: [['preuve', 'Preuve'], ['doute', 'Doute'], ['nouvelle', 'Nouvelle']], get: function () { return nouveau.type; }, set: function (v) { nouveau.type = v; } })),
        champ('Ce que j\'ai constaté', { type: 'textarea', rows: 2, get: function () { return nouveau.texte; }, set: function (v) { nouveau.texte = v; } }),
        h('button', { class: 'action', type: 'button', onclick: function () {
          if (!nouveau.texte.trim()) return; entrees.push({ date: nouveau.date, type: nouveau.type, texte: nouveau.texte.trim() }); sauver(); monter();
        } }, 'Ajouter au carnet')));
      entrees.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).forEach(function (e) {
        zone.appendChild(h('div', { class: 'carte' }, h('div', { class: 'rang' }, puce(e.type, e.type === 'doute' ? 'ex' : e.type === 'preuve' ? 'ok' : 'neutre'), h('span', { class: 'note' }, e.date)), h('p', null, e.texte),
          h('button', { class: 'discret', type: 'button', onclick: function () { entrees.splice(entrees.indexOf(e), 1); sauver(); monter(); } }, 'Retirer')));
      });
    }
    monter();
    return bloc('Carnet de bord par piste', 'I53', h('div', { class: 'cartes' },
      note('Chaque hypothèse garde ses preuves, ses doutes et sa date de dernière nouvelle, comme un carnet de chantier.'),
      champ('Piste', { type: 'select', options: optionsPistes('Choisir une piste'), get: function () { return ui.carnetPiste || ''; }, set: function (v) { ui.carnetPiste = v || null; monter(); } }),
      zone));
  }

  function ongletExperience() {
    var c = ['experience'];
    var semaines = h('div', { class: 'tableau' });
    function tableau() {
      semaines.textContent = '';
      var corps = h('tbody');
      for (var i = 0; i < 13; i++) (function (i) {
        var sem = etat.experience.semaines[i] || (etat.experience.semaines[i] = { heures: null, euros: null });
        var debut = etat.experience.debut ? M.ajouterJours(etat.experience.debut, 7 * i) : null;
        corps.appendChild(h('tr', null, h('td', null, 'Semaine ' + (i + 1) + (debut ? ' (du ' + debut + ')' : '')),
          h('td', null, saisie({ type: 'number', min: 0, label: 'Heures, semaine ' + (i + 1), get: function () { return sem.heures; }, set: function (v) { sem.heures = v; } })),
          h('td', null, saisie({ type: 'number', min: 0, label: 'Euros gagnés, semaine ' + (i + 1), get: function () { return sem.euros; }, set: function (v) { sem.euros = v; } }))));
      })(i);
      semaines.appendChild(h('table', null, h('thead', null, h('tr', null, h('th', null, 'Semaine'), h('th', null, 'Heures'), h('th', null, 'Euros'))), corps));
    }
    tableau();
    var bilan = sortie('dl', function (el) {
      el.className = 'chiffres';
      var b = M.bilanExperience(etat.experience.semaines);
      [dt('Heures au total', fr(b.heures, 1)), dt('Euros au total', eur(b.euros)), dt('Heures par semaine, en moyenne', b.heuresParSemaine === null ? '—' : fr(b.heuresParSemaine, 1)),
        dt('Euros par heure', b.eurosHeure === null ? '—' : fr(b.eurosHeure, 1))].forEach(function (x) { el.appendChild(x); });
    });
    return bloc('L\'expérience de trois mois', 'I121', h('div', { class: 'cartes' },
      note('Trois mois à tester un rythme de travail réduit, comme une expérience, avant de décider quoi que ce soit. Chaque semaine : les heures passées (invisibles comprises) et les euros gagnés.'),
      grille(champ('Début de l\'expérience', liant(c.concat('debut'), { type: 'date', set: function (v) { fixer(c.concat('debut'), v); tableau(); } })),
        champ('Repère d\'heures par semaine (facultatif)', liant(c.concat('heuresParSemaine'), { type: 'number', min: 0 }))),
      sortie('p', function (el) { el.className = 'note'; var d = etat.experience.debut; el.textContent = d ? 'Fin prévue : ' + M.ajouterMois(d, 3) + '.' : ''; }),
      semaines, bilan));
  }

  /* ---------- 5. Décision ---------- */
  function tableauCalendrier() {
    var ev = etat.decision.calendrier.filter(function (e) { return e.debut; });
    var an = new Date().getUTCFullYear(), de = an, a = an + 9;
    ev.forEach(function (e) { var d = parseInt(e.debut, 10), f = parseInt(e.fin || e.debut, 10); if (d < de) de = d; if (f > a) a = f; });
    var cal = M.calendrierAnnees(ev, de, a);
    var tete = h('tr', null, h('th', null, ''));
    cal.forEach(function (x) { tete.appendChild(h('th', null, x.annee)); });
    var corps = h('tbody');
    ev.forEach(function (e) {
      var tr = h('tr', null, h('td', null, e.nom + (e.bloquant ? ' (bloquant)' : '')));
      cal.forEach(function (x) { tr.appendChild(h('td', { class: 'n' }, x.evenements.indexOf(e.nom) >= 0 ? '■' : '·')); });
      corps.appendChild(tr);
    });
    var tp = h('tr', null, h('td', null, 'Virage possible'));
    cal.forEach(function (x) { tp.appendChild(h('td', { class: 'n' }, x.possible ? '✓' : '✗')); });
    corps.appendChild(tp);
    return h('div', { class: 'tableau' }, ev.length ? h('table', null, h('thead', null, tete), corps) : h('p', { class: 'vide' }, 'Ajoute des événements avec leurs dates pour voir quelles années sont possibles.'));
  }

  function ecranDecision(racine) {
    var d = ['decision'];
    /* phases */
    var etapes = sortie('div', function (el) {
      el.className = 'etapes';
      D.PHASES.forEach(function (ph) {
        el.appendChild(h('div', { class: 'etape' + (etat.decision.phase === ph.id ? ' ici' : '') }, h('strong', null, ph.nom + (etat.decision.phase === ph.id ? ' — tu es ici' : '')), h('div', { class: 'note' }, ph.aide)));
      });
    });
    var blocPhases = bloc('Les phases', 'I54', h('div', { class: 'cartes' },
      note('Comme pour un projet d\'architecture : tu sais toujours où tu en es.'),
      champ('Phase actuelle', liant(d.concat('phase'), { type: 'select', options: optionsDe(D.PHASES), set: function (v) { fixer(['decision', 'phase'], v); afficher(true); } })), etapes,
      champ('Notes sur la phase', { type: 'textarea', rows: 3, get: function () { return (etat.decision.phases[etat.decision.phase] || {}).note || ''; }, set: function (v) { fixer(d.concat('phases', etat.decision.phase, 'note'), v); } })));

    /* trois vies */
    var vies = h('div', { class: 'trois' });
    etat.decision.vies.forEach(function (v, i) {
      var cv = d.concat('vies', i);
      vies.appendChild(h('article', { class: 'carte' }, h('h3', null, v.nom),
        champ('En quelques phrases', liant(cv.concat('texte'), { type: 'textarea', rows: 3 })),
        v.ans.map(function (x, k) { return champ('Année ' + (k + 1), liant(cv.concat('ans', k), { type: 'text' })); }),
        champ('Le prototype à construire', liant(cv.concat('prototype'), { type: 'textarea', rows: 2 })),
        h('details', null, h('summary', null, 'Pistes de cette vie (revenu et semaine)'), sortieBouquet(v.parts), selecteurBouquet(v.parts, function () { sauver(); rafraichir(); }))));
    });
    var blocVies = bloc('Les trois vies', 'I45', h('div', { class: 'cartes' }, note('Trois futurs complets sur cinq ans : le prolongement, le virage, le saut. Chacun avec un prototype à faire.'), vies));

    /* calendrier */
    var listeEv = h('div', { class: 'cartes' }), tabCal = sortie('div', function (el) { el.appendChild(tableauCalendrier()); });
    function evenements() {
      listeEv.textContent = '';
      etat.decision.calendrier.forEach(function (e, i) {
        listeEv.appendChild(h('div', { class: 'carte' }, grille(
          champ('Événement', { type: 'text', get: function () { return e.nom; }, set: function (v) { e.nom = v; }, placeholder: 'ex. études, logement, projet familial' }),
          champ('Début (mois)', { type: 'month', get: function () { return e.debut; }, set: function (v) { e.debut = v; } }),
          champ('Fin (mois)', { type: 'month', get: function () { return e.fin; }, set: function (v) { e.fin = v; } })),
          champ('Empêche un virage cette année-là', { type: 'checkbox', get: function () { return e.bloquant; }, set: function (v) { e.bloquant = v; } }),
          h('button', { class: 'discret', type: 'button', onclick: function () { etat.decision.calendrier.splice(i, 1); sauver(); evenements(); rafraichir(); } }, 'Retirer')));
      });
    }
    evenements();
    var blocCal = bloc('Le calendrier', 'I51', h('div', { class: 'cartes' },
      note('Superpose tes projets de vie (logement, études, projet familial…). Un événement qui empêche un virage rend l\'année impossible.'),
      listeEv, h('button', { class: 'discret', type: 'button', onclick: function () { etat.decision.calendrier.push({ nom: '', debut: '', fin: '', bloquant: false }); sauver(); evenements(); } }, 'Ajouter un événement'), tabCal));

    /* points tous les six mois */
    var listePts = h('div', { class: 'cartes' });
    function points() {
      listePts.textContent = '';
      etat.decision.points.forEach(function (p, i) {
        listePts.appendChild(h('div', { class: 'carte' }, champ('Date du point', { type: 'date', get: function () { return p.date; }, set: function (v) { p.date = v; } }),
          champ('Ce qui a changé, et le cap corrigé', { type: 'textarea', rows: 3, get: function () { return p.texte; }, set: function (v) { p.texte = v; } }),
          h('button', { class: 'discret', type: 'button', onclick: function () { etat.decision.points.splice(i, 1); sauver(); points(); rafraichir(); } }, 'Retirer')));
      });
    }
    points();
    var blocPoints = bloc('Le point tous les six mois', 'I55', h('div', { class: 'cartes' },
      note('Pas pour décider une fois pour toutes : pour corriger le cap.'),
      sortie('p', function (el) {
        el.className = 'note';
        var dates = etat.decision.points.map(function (p) { return p.date; }).filter(Boolean).sort();
        var dern = dates[dates.length - 1];
        el.textContent = dern ? 'Prochain point : ' + M.prochainPoint(dern) + '.' : 'Pas encore de point : ajoute le premier.';
      }), listePts, h('button', { class: 'action', type: 'button', onclick: function () { etat.decision.points.push({ date: aujourdhui(), texte: '' }); sauver(); points(); rafraichir(); } }, 'Ajouter un point')));

    /* réécriture */
    var listeRe = h('div', { class: 'cartes' });
    function reecritures() {
      listeRe.textContent = '';
      etat.decision.reecritures.forEach(function (r, i) {
        listeRe.appendChild(h('div', { class: 'carte' }, champ('Date', { type: 'date', get: function () { return r.date; }, set: function (v) { r.date = v; } }),
          champ('La profession de vie, en toutes lettres', { type: 'textarea', rows: 4, get: function () { return r.texte; }, set: function (v) { r.texte = v; } }),
          h('button', { class: 'discret', type: 'button', onclick: function () { etat.decision.reecritures.splice(i, 1); sauver(); reecritures(); rafraichir(); } }, 'Retirer')));
      });
    }
    reecritures();
    var blocRe = bloc('La réécriture tous les sept ans', 'I56', h('div', { class: 'cartes' },
      note('La profession de vie se révise : la vie change de saison, tu la réécris.'),
      sortie('p', function (el) {
        el.className = 'note';
        var dates = etat.decision.reecritures.map(function (p) { return p.date; }).filter(Boolean).sort();
        var dern = dates[dates.length - 1];
        el.textContent = dern ? 'Prochaine réécriture : ' + M.prochaineReecriture(dern) + '.' : 'Pas encore de version écrite.';
      }), listeRe, h('button', { class: 'action', type: 'button', onclick: function () { etat.decision.reecritures.push({ date: aujourdhui(), texte: '' }); sauver(); reecritures(); rafraichir(); } }, 'Écrire une version')));

    /* date de fin */
    var blocFin = bloc('La date de fin de la recherche', 'I78', h('div', { class: 'cartes' },
      note('Une date, pour que la recherche ait une fin.'),
      champ('Date de fin', liant(d.concat('dateFin'), { type: 'date' })),
      sortie('p', function (el) {
        el.className = 'gros';
        var j = etat.decision.dateFin ? M.joursRestants(etat.decision.dateFin, aujourdhui()) : null;
        el.textContent = j === null ? '' : (j > 0 ? j + ' jour(s) restant(s)' : j === 0 ? 'C\'est aujourd\'hui' : 'Date passée depuis ' + (-j) + ' jour(s)');
      })));

    racine.appendChild(h('div', { class: 'cartes' }, blocPhases, blocVies, blocCal, blocPoints, blocRe, blocFin));
  }

  /* ---------- 6. Vue murale (ordinateur) ---------- */
  function barre(pct) { var i = document.createElement('i'); i.style.width = pct + '%'; return i; }
  function ecranMural(racine) {
    var zoom = 1;
    var planche = h('div', { class: 'mural', id: 'vue-mural' });
    function appliquer() { planche.style.zoom = zoom; etiquette.textContent = Math.round(zoom * 100) + ' %'; }
    var etiquette = h('span', { class: 'note' });
    function bouton(t, f) { return h('button', { class: 'discret', type: 'button', onclick: function () { zoom = Math.max(0.5, Math.min(2.5, f(zoom))); appliquer(); } }, t); }
    racine.appendChild(h('div', { class: 'cartes' },
      h('div', { class: 'mural-barre', 'data-idee': 'I60' }, bouton('− Dézoomer', function (z) { return z - 0.1; }), bouton('+ Zoomer', function (z) { return z + 0.1; }), bouton('100 %', function () { return 1; }),
        h('button', { class: 'discret', type: 'button', onclick: function () {
          /* ajuste le zoom pour que toute la planche tienne dans la hauteur de l'écran */
          var haut = planche.getBoundingClientRect().height, dispo = window.innerHeight - 24;
          zoom = Math.max(0.4, Math.min(2.5, zoom * dispo / Math.max(haut, 1))); appliquer(); planche.scrollIntoView({ block: 'start' });
        } }, 'Tout voir'), etiquette),
      h('p', { class: 'mural-hors note' }, 'La vue murale s\'ouvre sur un écran d\'ordinateur.'), planche));
    document.getElementById('page').classList.add('large');
    var g = reglages(), c = etat.cahier;
    var vives = pistesVives();
    var lignesCl = M.classer(vives, g, scenario(), 'vie', c.plafondHeures);
    var max = 0; lignesCl.forEach(function (l) { if (l.groupe === 0 && l.valeur > max) max = l.valeur; });

    function planchette(titre, idees, contenu, classe) { return h('section', { class: 'bloc ' + (classe || ''), 'data-idee': idees }, h('h2', null, titre), contenu); }
    planche.appendChild(planchette('Cahier des charges', 'I15 I122', h('div', { class: 'cartes' },
      c.revenu || M.nombre(c.revenuVise) !== null ? h('p', null, 'Revenu : ' + c.revenu + (M.nombre(c.revenuVise) !== null ? ' (visé : ' + eur(M.nombre(c.revenuVise)) + ')' : '')) : null,
      c.heures || M.nombre(c.plafondHeures) !== null ? h('p', null, 'Heures : ' + c.heures + (M.nombre(c.plafondHeures) !== null ? ' (plafond : ' + fr(M.nombre(c.plafondHeures)) + ' h/sem.)' : '')) : null,
      c.lieu || c.statut ? h('p', null, [c.lieu, c.statut].filter(Boolean).join(' · ')) : null, marge() !== null ? h('p', null, 'Au maximum ' + fr(marge()) + ' mois sans revenu') : null,
      c.tempsLibre ? h('p', null, 'Le temps libre va à ' + c.tempsLibre) : null, c.titre.texte ? h('p', { class: 'gros' }, c.titre.texte) : null)));
    planche.appendChild(planchette('Classement (€ par heure de vie)', 'I84 I87', h('div', { class: 'cartes' },
      lignesCl.filter(function (l) { return l.groupe === 0; }).slice(0, 10).map(function (l) {
        return h('div', null, h('div', { class: 'rang' }, h('strong', null, l.rang + '. ' + l.piste.nom), h('span', { class: 'n' }, fr(l.valeur, 1) + ' €/h')), h('div', { class: 'barre' }, barre(max > 0 ? Math.round(100 * l.valeur / max) : 0)));
      }), lignesCl.every(function (l) { return l.groupe !== 0; }) ? h('p', { class: 'vide' }, 'Aucune piste chiffrée pour l\'instant.') : null), 'large2'));
    planche.appendChild(planchette('Pistes', 'I25', h('div', { class: 'cartes' },
      h('p', null, vives.length + ' piste(s) en vue · ' + (pistes().length - vives.length) + ' éliminée(s)'),
      vives.filter(function (p) { return p.statut === 'hypothese'; }).map(function (p) { return h('p', null, '● ' + p.nom); }))));
    planche.appendChild(planchette('Mois sans revenu', 'I117', h('div', { class: 'cartes' },
      vives.filter(function (p) { return M.nombre(p.moisSansRevenu) !== null; }).map(function (p) {
        return h('div', { class: 'rang' }, h('span', null, p.nom), puce(fr(M.nombre(p.moisSansRevenu)) + ' mois' + (M.auDelaMarge(p, marge()) ? ' · au-delà de ta marge' : ''), M.auDelaMarge(p, marge()) ? 'non' : 'ok'));
      }), vives.every(function (p) { return M.nombre(p.moisSansRevenu) === null; }) ? h('p', { class: 'vide' }, 'Aucune piste n\'a encore ce chiffre.') : null)));
    planche.appendChild(planchette('Tests en cours', 'I38', h('div', { class: 'cartes' },
      etat.tests.map(function (t) { var v = M.verdictTest(t, aujourdhui()); return h('div', { class: 'rang' }, h('span', null, (piste(t.piste) || { nom: '?' }).nom), puce(v.texte, v.etat === 'atteints' ? 'ok' : v.etat === 'non_atteints' ? 'non' : 'neutre')); }),
      etat.tests.length ? null : h('p', { class: 'vide' }, 'Aucun test.'))));
    planche.appendChild(planchette('Phase', 'I54', h('div', { class: 'cartes' }, D.PHASES.map(function (ph) {
      return h('div', { class: 'etape' + (ph.id === etat.decision.phase ? ' ici' : '') }, ph.nom + (ph.id === etat.decision.phase ? ' ◀' : ''));
    }))));
    planche.appendChild(planchette('Trois vies', 'I45', h('div', { class: 'cartes' }, etat.decision.vies.map(function (v) {
      var r = resumeBouquet(v.parts);
      return h('div', { class: 'carte' }, h('strong', null, v.nom), h('span', { class: 'note' }, r.n ? eur(r.b.revenu) + ' par an · ' + fr(r.b.heuresSemaine, 1) + ' h/sem.' : 'pas de pistes choisies'));
    })), 'large2'));
    var pts = etat.decision.points.map(function (p) { return p.date; }).filter(Boolean).sort(), re = etat.decision.reecritures.map(function (p) { return p.date; }).filter(Boolean).sort();
    var jf = etat.decision.dateFin ? M.joursRestants(etat.decision.dateFin, aujourdhui()) : null;
    planche.appendChild(planchette('Dates', 'I55 I56 I78', h('div', { class: 'cartes' },
      h('p', null, 'Prochain point : ' + (pts.length ? M.prochainPoint(pts[pts.length - 1]) : '—')),
      h('p', null, 'Prochaine réécriture : ' + (re.length ? M.prochaineReecriture(re[re.length - 1]) : '—')),
      h('p', null, 'Date de fin : ' + (etat.decision.dateFin ? etat.decision.dateFin + (jf !== null ? ' (' + jf + ' j)' : '') : '—')))));
    var b = M.bilanExperience(etat.experience.semaines);
    planche.appendChild(planchette('Expérience de trois mois', 'I121', h('div', { class: 'cartes' },
      h('p', null, etat.experience.debut ? 'Depuis le ' + etat.experience.debut : 'Pas commencée'), h('p', null, fr(b.heures, 1) + ' h · ' + eur(b.euros)), h('p', null, b.eurosHeure === null ? '— € par heure' : fr(b.eurosHeure, 1) + ' € par heure'))));
    planche.appendChild(planchette('Calendrier', 'I51', tableauCalendrier(), 'large3'));
    appliquer();
  }

  /* ================= le classement (écran d'ouverture) et le détail d'une piste ================= */
  var NOMS_SUPPOSE = { distance: 'la part à distance', joursSemaine: 'les jours par semaine', moisSansRevenu: 'le mois sans revenu', droitEntree: 'le droit d\'entrée', chantier: 'le suivi de chantier' };
  function chiffreHoraire(base) {
    return h('span', { class: 'piste-chiffre' }, fr(base.valeur, 0) + ' €/h', h('small', null, base.nature + (base.supposee ? ' · supposé' : '')));
  }
  function mentionsPuces(mentions) {
    return h('span', { class: 'piste-mentions' }, mentions.map(function (m) { return puce(m.texte, m.ton); }));
  }
  function ligneClassement(l) {
    return h('li', null, h('button', { class: 'piste-ligne', type: 'button', 'data-piste': l.piste.id, onclick: function () { ui.detail = l.piste.id; aller('detail'); } },
      h('span', { class: 'piste-rang' }, l.rang ? String(l.rang) : '·'),
      h('span', { class: 'piste-nom' }, l.piste.nom),
      l.base ? chiffreHoraire(l.base) : h('span', { class: 'piste-chiffre' }, h('small', null, 'sans chiffre')),
      mentionsPuces(l.mentions.slice(0, 2))));      // deux mentions au plus par ligne ; le détail dit le reste
  }
  function ecranClassement(racine) {
    var g = reglages(), m = marge();
    var barre = h('div', { class: 'filtres', role: 'group', 'aria-label': 'Filtre' },
      [['tout', 'Tout'], ['independante', 'Indépendante'], ['salariee', 'Salariée'], ['porteurs', 'Porteurs']].map(function (f) {
        return h('button', { class: 'onglet', type: 'button', 'data-filtre': f[0], 'aria-pressed': ui.filtreClassement === f[0] ? 'true' : 'false', 'aria-selected': ui.filtreClassement === f[0] ? 'true' : 'false',
          onclick: function () { ui.filtreClassement = f[0]; ui.nbVisibles = 10; afficher(true); } }, f[1]);
      }));
    var r = M.classementPrincipal(pistes(), g, m, ui.filtreClassement);
    var liste = h('ol', { class: 'pistes-liste', 'data-idee': 'I84 I87' }, r.classees.slice(0, ui.nbVisibles).map(ligneClassement));
    var reste = r.classees.length - ui.nbVisibles;
    racine.appendChild(h('div', { class: 'cartes' },
      barre,
      ui.filtreClassement === 'porteurs' ? note('Métiers « porteurs » : une prévision n\'est pas une certitude. Ouvre une piste pour sa source.') : null,
      note('Euros par heure, avec la nature du chiffre : brut ou facturé HT.'),
      h('details', null, h('summary', null, 'Comment lire ce chiffre'),
        note('Un salaire brut et un tarif facturé hors taxes ne se comparent pas directement : charges, impôts et jours sans mission ne sont pas retirés. Les heures du calcul (35 h par semaine, 45 semaines, 7 h par journée) sont supposées. Les pistes sans chiffre sont en bas : rien n\'y est estimé.')),
      r.classees.length ? liste : h('p', { class: 'vide' }, 'Aucune piste chiffrée avec ce filtre.'),
      reste > 0 ? h('button', { class: 'discret', type: 'button', onclick: function () { ui.nbVisibles += 15; afficher(true); } }, 'Voir les ' + Math.min(15, reste) + ' suivantes (' + reste + ' restantes)') : null,
      r.sansChiffre.length ? h('details', { 'data-idee': 'I87' }, h('summary', null, 'Sans chiffre pour l\'instant (' + r.sansChiffre.length + ')'),
        h('div', { class: 'cartes' }, note('Rien n\'est estimé pour ces pistes : un fait inconnu reste vide.'), h('ol', { class: 'pistes-liste' }, r.sansChiffre.map(ligneClassement)))) : null,
      prochaineAction(r)));
  }
  function prochaineAction(r) {
    var l = r.classees[0] || r.sansChiffre[0];
    if (!l) return null;
    return h('section', { class: 'bloc prochaine', 'data-idee': 'I84' }, h('h2', null, 'Prochaine action'),
      h('p', null, M.prochaineVerification(l.piste, reglages(), marge())),
      h('button', { class: 'action', type: 'button', onclick: function () { ui.detail = l.piste.id; aller('detail'); } }, 'Ouvrir « ' + l.piste.nom + ' »'));
  }

  function ecranDetail(racine) {
    var p = ui.detail ? piste(ui.detail) : null;
    if (!p) { ui.ecran = 'classement'; ecranClassement(racine); return; }
    racine.appendChild(h('div', { class: 'cartes' },
      h('button', { class: 'discret retour', type: 'button', onclick: function () { aller('classement'); } }, '← Tes meilleures pistes'),
      h('section', { class: 'bloc', 'data-idee': 'I84 I87 I114 I116 I117' }, h('h2', null, p.nom),
        sortie('div', function (el) {
          var q = piste(p.id), g = reglages(), r = M.classementPrincipal(pistes(), g, marge(), 'tout');
          var ligne = r.classees.filter(function (x) { return x.piste.id === q.id; })[0];
          if (ligne) {
            el.appendChild(h('div', { class: 'rang' }, h('span', { class: 'gros' }, fr(ligne.base.valeur, 0) + ' €/h'), puce(ligne.base.nature, 'neutre'), ligne.base.supposee ? puce('supposé', 'ex') : null));
            el.appendChild(h('p', null, 'Rang ' + ligne.rang + ' sur ' + r.classees.length + ' pistes chiffrées.'));
            el.appendChild(h('p', { class: 'note' }, 'Pourquoi : ' + ligne.base.calcul + '. ' + (ligne.base.nature === 'brut' ? 'Un salaire brut n\'est pas un tarif facturé : charges et impôts viennent déjà en moins pour toi.' : 'Un tarif hors taxes n\'est pas un revenu : charges, impôts et jours sans mission viennent en moins.')));
          } else {
            el.appendChild(h('p', null, 'Pas de rang : cette piste n\'a pas encore de chiffre en euros par heure. ' + M.prochaineVerification(q, g, marge())));
          }
          el.appendChild(mentionsPuces(M.mentionsPiste(q, marge())));
        }),
        h('h3', null, 'Ce qu\'on peut corriger'),
        note('Seulement ce qui change le rang. Une valeur que tu saisis n\'est plus « supposée ».'),
        champsClassement(p),
        h('h3', null, 'Ce qui manque'),
        sortie('ul', function (el) {
          var q = piste(p.id), t = [];
          (q.faitsInconnus || []).forEach(function (x) { t.push('Inconnu : ' + x); });
          (q.supposes || []).forEach(function (c) { t.push('Supposé : ' + (NOMS_SUPPOSE[c] || c)); });
          if (q.manque) t.push('Pour te lancer : ' + q.manque);
          if (!t.length) t.push('Rien de noté.');
          t.forEach(function (x) { el.appendChild(h('li', null, x)); });
        }, { class: 'sources' }),
        h('h3', null, 'Sources'), (p.sources && p.sources.length) ? listeSources(p) : h('p', { class: 'vide' }, 'Aucune source : tout chiffre ici serait à vérifier.'),
        sortie('section', function (el) {
          el.appendChild(h('h3', null, 'Prochaine vérification'));
          el.appendChild(h('p', null, M.prochaineVerification(piste(p.id), reglages(), marge())));
        }, { class: 'cartes' }),
        p.porteur ? blocPorteur(p.porteur) : null,
        h('details', { 'data-idee': 'I25 I37 I38 I46 I53 I89' }, h('summary', null, 'Tout le reste de la fiche (carnet, patron, hypothèse, examens)'),
          ficheComplete(piste(p.id))))));
  }
  /* métier porteur : les informations de l'enquête (chaque chiffre avec sa source ; un fait introuvable est dit, jamais comblé) */
  function lienSource(s) {
    if (!s) return null;
    return h('span', { class: 'note' }, ' (', s.url ? h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, s.titre || s.url) : (s.titre || ''), s.date_publication ? ' · ' + s.date_publication : '', s.ouverte === false ? ' · page non ouverte' : '', ')');
  }
  function ligneFait(titre, texte, source) {
    return h('li', null, h('strong', null, titre + ' : '), texte === null || texte === undefined || texte === '' ? h('em', null, 'introuvable') : texte, lienSource(source));
  }
  function blocPorteur(f) {
    var P = MetierPorteurs, nbf = function (v) { return typeof v === 'number' ? fr(v, 0) : null; };
    var c = f.croissance || {}, ia = f.ia || {}, h2 = f.heures || {}, d = f.distance || {}, a = f.acces || {};
    var revenus = (f.revenus || []).map(function (r) {
      var v = (r.bas !== null && r.bas !== undefined ? nbf(r.bas) : '?') + (r.haut !== null && r.haut !== undefined ? ' à ' + nbf(r.haut) : '') + ' ' + (P.UNITES[r.unite] || r.unite);
      return ligneFait(P.PROFILS[r.profil] || r.profil, v, r.source);
    });
    var man = P.manques(f);
    return h('div', { class: 'cartes', 'data-idee': 'I21' },
      h('h3', null, 'Métier porteur : les informations'),
      note(man.length ? 'Fiche incomplète : il manque ' + man.join(', ') + '. Rien n\'est comblé par une estimation.' : 'Fiche complète : tous les points demandés ont une valeur et une source.'),
      h('p', null, f.quoi || ''), f.journee ? h('p', { class: 'note' }, 'Une journée type : ' + f.journee) : null,
      h('ul', { class: 'sources' },
        ligneFait('Pourquoi il croîtrait', [c.texte, c.chiffre ? '(' + c.chiffre + (c.horizon ? ', horizon ' + c.horizon : '') + ')' : null].filter(Boolean).join(' '), c.source),
        h('li', null, 'Nature : ', h('strong', null, P.NATURES_CROISSANCE[c.nature] || 'non précisée'), (c.nature === 'prevision_publiee' || c.nature === 'projection_publiee') ? ' (une prévision n\'est pas une certitude)' : '', c.portee ? ' · ' + P.PORTEES[c.portee] : ''),
        c.desaccords ? ligneFait('Désaccords entre sources', c.desaccords) : null,
        ligneFait('Risque lié à l\'IA', (ia.risque ? (P.RISQUES_IA[ia.risque] || ia.risque) + '. ' : '') + (ia.texte || '') + (ia.nature ? ' [' + (P.NATURES_CROISSANCE[ia.nature] || ia.nature) + ']' : ''), ia.source)),
      h('h3', null, 'Revenus'), revenus.length ? h('ul', { class: 'sources' }, revenus) : h('p', { class: 'vide' }, 'Aucun revenu trouvé.'),
      h('h3', null, 'Heures et distance'),
      h('ul', { class: 'sources' },
        ligneFait('Temps partiel', h2.temps_partiel && h2.temps_partiel !== 'inconnu' ? h2.temps_partiel + (h2.texte ? ' — ' + h2.texte : '') : null, h2.source),
        ligneFait('Part à distance', (d.salarie && d.salarie !== 'inconnue' ? 'salarié : ' + d.salarie : '') + (d.independant && d.independant !== 'inconnue' ? ' ; indépendant : ' + d.independant : '') + (d.texte ? ' — ' + d.texte : '') || null, d.source)),
      h('h3', null, 'Modalités d\'accès'),
      h('ul', { class: 'sources' },
        ligneFait('Diplôme ou certification', a.diplome), ligneFait('Obligatoire ou réglementé', a.reglemente_ou_obligatoire),
        ligneFait('Durée', a.duree_mois === null || a.duree_mois === undefined ? null : fr(a.duree_mois, 0) + ' mois'), ligneFait('Coût', a.cout_euros === null || a.cout_euros === undefined ? null : fr(a.cout_euros, 0) + ' €'),
        ligneFait('Financements', (a.financements || []).join(', ')), ligneFait('VAE ou dispense (diplôme, équivalence)', a.vae_ou_dispense),
        ligneFait('Organismes (exemples)', (a.organismes || []).join(', ')), ligneFait('Prérequis', a.prerequis), ligneFait('Inscription ou assurance', a.inscription_assurance),
        (a.sources || []).length ? h('li', null, h('strong', null, 'Sources : '), (a.sources || []).map(function (s) { return lienSource(s); })) : null),
      h('h3', null, 'Délai avant le premier revenu'),
      h('p', null, f.delai_premier_revenu_mois === null || f.delai_premier_revenu_mois === undefined ? h('em', null, 'introuvable') : fr(f.delai_premier_revenu_mois, 0) + ' mois' + (marge() !== null ? ', comparé à ta marge de ' + fr(marge(), 0) + ' mois' : '') + '.'),
      h('h3', null, 'Première action à moins de 30 jours'), h('p', null, f.premiere_action_30j || h('em', null, 'introuvable')));
  }

  /* les seuls champs qui changent le rang : le chiffre lui-même et les heures */
  function champsClassement(p) {
    var brut = (M.baseHoraire(p, reglages()) || {}).nature === 'brut' || p.nature === 'brut';
    var c = brut
      ? [champ('Salaire brut par an, bas (€)', pc(p, 'revenuBas', 'number', { min: 0 })), champ('Jours par semaine', pc(p, 'joursSemaine', 'number', { min: 0 })),
         champ('Heures par semaine (facultatif, remplace les jours)', pc(p, 'heuresVisSemaine', 'number', { min: 0 }))]
      : [champ('Tarif par jour, bas (€ hors taxes)', pc(p, 'tarifBas', 'number', { min: 0 })), champ('Tarif par heure, bas (€ hors taxes, facultatif)', liant(['pistes', p.id, 'euroHeureBas'], { type: 'number', min: 0 }))];
    return grille.apply(null, c);
  }

  /* ================= navigation ================= */
  var SCREENS_PLUS = [];
  function aller(id) { ui.ecran = id; afficher(false); window.scrollTo(0, 0); }
  function afficher(garderScroll) {
    var y = window.scrollY;
    var racine = document.getElementById('ecran');
    racine.textContent = ''; sorties = [];
    document.getElementById('page').classList.remove('large');
    var principal = ui.ecran === 'classement' || ui.ecran === 'detail';
    document.getElementById('titre-app').hidden = !principal;
    document.getElementById('phrase-app').hidden = !principal;
    if (ui.ecran === 'classement') ecranClassement(racine);
    else if (ui.ecran === 'detail') ecranDetail(racine);
    else {
      var e = ECRANS.filter(function (x) { return x.id === ui.ecran; })[0];
      if (!e) { ui.ecran = 'classement'; ecranClassement(racine); }
      else {
        racine.appendChild(h('button', { class: 'discret retour', type: 'button', onclick: function () { aller('classement'); } }, '← Tes meilleures pistes'));
        racine.appendChild(h('h2', null, e.nom));
        e.f(racine);
      }
    }
    sorties.forEach(function (s) { s.dejaMonte = true; });
    if (garderScroll) window.scrollTo(0, y);
  }

  function majAlerteStockage() {
    var n = document.getElementById('alerte-stockage');
    if (stockageOk) { if (n) n.remove(); return; }
    if (!n) {
      n = h('p', { class: 'bloc', id: 'alerte-stockage', role: 'alert' }, 'Le stockage de ce navigateur n\'est pas disponible (navigation privée ou réglage). Tes saisies ne sont pas gardées : utilise « Données : export » avant de fermer la page.');
      document.getElementById('page').insertBefore(n, document.getElementById('ecran'));
    }
  }

  /* ---------- Données : export, import ---------- */
  /* ---------- synchro entre appareils : un fichier réservé dans le dépôt privé lié à la carte (voir synchro.js) ---------- */
  function resumeEtat(x) {
    var noms = (x.pistesPerso || []).slice(0, 4).map(function (p) { return '« ' + p.nom + ' »'; }).join(', ');
    return Object.keys(x.pistes || {}).length + ' piste(s) modifiée(s), ' + (x.pistesPerso || []).length + ' ajoutée(s)' + (noms ? ' (' + noms + ((x.pistesPerso || []).length > 4 ? '…' : '') + ')' : '') + ', ' + (x.tests || []).length + ' test(s)';
  }
  var qrCharge = null;
  function chargerQr() {
    return (qrCharge = qrCharge || new Promise(function (ok, ko) { var s = document.createElement('script'); s.src = 'qr.js'; s.onload = ok; s.onerror = ko; document.head.appendChild(s); }));
  }
  function blocSynchro() {
    var statutL = h('p', { class: 'note', role: 'status' }), zoneConflit = h('div', { class: 'cartes' }), btn;
    function dit(t) { statutL.textContent = t; }
    function quand() { var n = MetierSynchro.note(); return n.quand ? 'Dernière synchro réussie : ' + String(n.quand).slice(0, 16).replace('T', ' ') + ' (UTC).' : 'Jamais synchronisé depuis cet appareil.'; }
    function repris(texte, sha, msg) {
      var r = M.importer(texte);
      if (!r.ok) { dit('Le fichier distant n\'est pas un état Métier lisible : ' + r.erreur + ' Rien n\'a été changé.'); return; }
      etat = r.etat; sauver(); afficher(false);
      MetierSynchro.repris(M.exporter(etat), sha).then(function () { dit(msg + ' ' + quand()); });
    }
    function conflit(r) {
      var d = M.importer(r.texteDistant);
      function fin(msg) { zoneConflit.textContent = ''; dit(msg); }
      zoneConflit.textContent = '';
      zoneConflit.appendChild(h('div', { class: 'carte' }, h('h3', null, 'Conflit : cet appareil et le fichier distant ont changé tous les deux'),
        h('p', null, 'Cet appareil : ' + resumeEtat(etat)), h('p', null, 'Fichier distant : ' + (d.ok ? resumeEtat(d.etat) : 'illisible')),
        note('Rien n\'a été écrasé. Pense à « Exporter en JSON » avant de choisir : ce qui est remplacé ne se retrouve pas.'),
        h('div', { class: 'rang' },
          h('button', { class: 'discret', type: 'button', onclick: function () {
            if (!confirm('Remplacer le fichier distant par les données de cet appareil ?')) return;
            MetierSynchro.garderCetAppareil(M.exporter(etat), r.shaDistant).then(function () { fin('Envoyé : GitHub a confirmé. ' + quand()); }, function (x) { dit(MetierSynchro.message(x)); });
          } }, 'Garder cet appareil'),
          h('button', { class: 'discret', type: 'button', disabled: !d.ok, onclick: function () {
            if (!confirm('Remplacer les données de cet appareil par celles du fichier distant ?')) return;
            zoneConflit.textContent = ''; repris(r.texteDistant, r.shaDistant, 'Version distante reprise ici.');
          } }, 'Prendre le fichier distant'),
          h('button', { class: 'discret', type: 'button', onclick: function () { fin('Rien n\'a été changé ni envoyé.'); } }, 'Ne rien faire'))));
      dit('Conflit : rien n\'a été écrasé. Choisis ci-dessous.');
    }
    btn = h('button', { class: 'action', type: 'button', onclick: function () {
      zoneConflit.textContent = ''; btn.disabled = true; dit('Synchronisation en cours…');
      MetierSynchro.synchroniser(M.exporter(etat), M.exporter(M.etatVide())).then(function (r) {
        if (r.action === 'conflit') { conflit(r); return; }
        if (r.action === 'recevoir') { repris(r.texteDistant, r.shaDistant, 'Version reçue des autres appareils : reprise ici (rien n\'avait changé ici depuis la dernière synchro).'); return; }
        dit({ cree: 'Premier envoi : GitHub a confirmé la création du fichier dans ton dépôt privé. ', envoye: 'Envoyé : GitHub a confirmé. ', a_jour: 'Déjà à jour : GitHub a confirmé. ' }[r.action] + quand());
      }).catch(function (x) { dit(MetierSynchro.message(x)); }).then(function () { btn.disabled = false; });
    } }, 'Synchroniser maintenant');
    dit(quand());
    return h('div', { class: 'cartes', id: 'bloc-synchro' }, h('h3', null, 'Synchro entre appareils'),
      note('Optionnelle. Les données restent d\'abord sur cet appareil ; la synchro les recopie, quand tu le demandes, dans un fichier réservé à cette app du dépôt privé déjà lié à ta carte. Si les deux versions ont changé, rien n\'est écrasé : tu choisis.'),
      btn, statutL, zoneConflit);
  }
  function panneauDonnees() {
    var p = document.getElementById('vue-donnees');
    p.textContent = '';
    var zone = h('textarea', { rows: 6, 'aria-label': 'Texte JSON des données', readonly: true });
    zone.value = M.exporter(etat);
    var message = h('p', { class: 'note', role: 'status' });
    function appliquerImport(texte) {
      var r = M.importer(texte);
      if (!r.ok) { message.textContent = 'Import impossible : ' + r.erreur + ' Rien n\'a été changé.'; return; }
      if (!confirm('Remplacer toutes les données de cette page par celles de l\'import ?')) { message.textContent = 'Import annulé. Rien n\'a été changé.'; return; }
      etat = r.etat; sauver(); message.textContent = 'Import fait.'; afficher(false); zone.value = M.exporter(etat);
    }
    var fichier = h('input', { type: 'file', accept: 'application/json,.json', 'aria-label': 'Fichier JSON à importer' });
    fichier.addEventListener('change', function () {
      var f = fichier.files && fichier.files[0]; if (!f) return;
      var lecteur = new FileReader();
      lecteur.onload = function () { appliquerImport(String(lecteur.result)); fichier.value = ''; };
      lecteur.onerror = function () { message.textContent = 'Le fichier n\'a pas pu être lu.'; };
      lecteur.readAsText(f);
    });
    var collage = h('textarea', { rows: 4, placeholder: 'Colle ici un texte JSON exporté', 'aria-label': 'Coller un texte JSON' });
    p.appendChild(h('h2', null, 'Données'));
    p.appendChild(note('Tout ce que tu saisis reste dans le stockage de ce navigateur, sur cet appareil. L\'export en fait un fichier à garder ; l\'import le remet.'));
    p.appendChild(h('div', { class: 'rang' },
      h('button', { class: 'action', type: 'button', onclick: function () {
        try {
          var blob = new Blob([M.exporter(etat)], { type: 'application/json' }), a = h('a', { href: URL.createObjectURL(blob), download: 'metier-' + aujourdhui() + '.json' });
          document.body.appendChild(a); a.click(); a.remove(); message.textContent = 'Export lancé.';
        } catch (e) { message.textContent = 'Le téléchargement a échoué : copie le texte ci-dessous.'; }
        zone.value = M.exporter(etat);
      } }, 'Exporter en JSON'),
      h('button', { class: 'discret', type: 'button', onclick: function () {
        zone.value = M.exporter(etat);
        try { navigator.clipboard.writeText(zone.value).then(function () { message.textContent = 'Texte copié.'; }, function () { zone.select(); message.textContent = 'Le texte est sélectionné : copie-le à la main.'; }); }
        catch (e) { zone.select(); message.textContent = 'Le texte est sélectionné : copie-le à la main.'; }
      } }, 'Copier le texte'),
      h('button', { class: 'discret', type: 'button', onclick: function () {
        if (!confirm('Effacer toutes les données de cette page ? Pense à exporter avant.')) return;
        etat = M.etatVide(); sauver(); message.textContent = 'Données effacées.'; afficher(false); zone.value = M.exporter(etat);
      } }, 'Tout effacer')));
    p.appendChild(h('label', null, 'Importer un fichier JSON', fichier));
    p.appendChild(h('details', null, h('summary', null, 'Copier ou coller le texte'), h('div', { class: 'cartes' }, zone, collage,
      h('button', { class: 'discret', type: 'button', onclick: function () { appliquerImport(collage.value); } }, 'Importer le texte collé'))));
    p.appendChild(message);
    p.appendChild(blocSynchro());
    var zc = h('div', { id: 'connexion-ecran' }); p.appendChild(zc);
    try {
      Connexion.monter(zc, { nomApp: 'Métier', carteUrl: location.origin + '/carte-de-vie/',
        qr: function (t) { return chargerQr().then(function () { var q = qrcode(0, 'M'); q.addData(t); q.make(); return q.createDataURL(6, 2); }); },
        apres: function () { var s = document.querySelector('#bloc-synchro [role=status]'); if (s) s.textContent = 'Connexion changée : relance la synchro.'; } });
    } catch (x) { zc.appendChild(h('p', { class: 'vide' }, 'L\'écran de connexion n\'a pas pu s\'afficher ici.')); }
  }

  /* ================= démarrage ================= */
  function panneauPlus() {
    var p = document.getElementById('vue-plus');
    p.textContent = '';
    p.appendChild(h('h2', null, 'Plus'));
    p.appendChild(note('Tout ce qui n\'est pas le classement. Le détail d\'une piste réunit déjà ce qui change son rang.'));
    var ids = ['recolte', 'cahier', 'compteur', 'pistes', 'tests', 'decision', 'mural'];
    var liste = h('div', { class: 'plus-liste' });
    ids.forEach(function (id) {
      var e = ECRANS.filter(function (x) { return x.id === id; })[0];
      liste.appendChild(h('button', { class: 'discret', type: 'button', id: id === 'mural' ? 'onglet-mural' : null, 'data-ecran': id, onclick: function () { fermerPlus(); aller(id); } }, e.nom));
    });
    liste.appendChild(h('button', { class: 'discret', type: 'button', onclick: function () { fermerPlus(); ui.sous.pistes = 'galerie'; aller('pistes'); } }, 'Galerie de parcours'));
    liste.appendChild(h('button', { class: 'discret', type: 'button', onclick: function () { fermerPlus(); var d = document.getElementById('vue-donnees'); panneauDonnees(); d.hidden = false; d.scrollIntoView(); } }, 'Données : export, import'));
    p.appendChild(liste);
  }
  function fermerPlus() { document.getElementById('vue-plus').hidden = true; document.getElementById('bouton-plus').setAttribute('aria-expanded', 'false'); }
  function demarrer() {
    document.getElementById('version').textContent = M.VERSION;
    var bp = document.getElementById('bouton-plus');
    bp.addEventListener('click', function () {
      var pl = document.getElementById('vue-plus'), ouvert = pl.hidden;
      if (ouvert) panneauPlus();
      pl.hidden = !ouvert; bp.setAttribute('aria-expanded', ouvert ? 'true' : 'false');
    });
    majAlerteStockage();
    afficher(false);
  }
  demarrer();
})();
