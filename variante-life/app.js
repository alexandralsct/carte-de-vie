/* Ma carte de vie, variante « style LIFE » — lecture seule pour l'instant.
   La carte se lit depuis le dépôt privé avec la clé saisie une fois sur l'appareil. Tout texte reçu est affiché avec textContent. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var donnees = null;
  var choisi = 'moi';            /* 'moi' ou la clé d'un espace */
  var repliees = false;
  var vueCarte = {};             /* élément coché : affichage « comme dans la carte » */

  function lire(cle) { try { return localStorage.getItem(cle) || ''; } catch (e) { return ''; } }
  function ecrire(cle, val) { try { localStorage.setItem(cle, val); return true; } catch (e) { return false; } }
  function el(tag, cls, texte) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (texte !== undefined && texte !== null) n.textContent = String(texte);
    return n;
  }

  /* ---------- données ---------- */
  function espaces() {
    if (!donnees) return [];
    return Object.keys(donnees).filter(function (k) {
      return k.indexOf('espaces/') === 0 && donnees[k] && !donnees[k]._del;
    }).map(function (k) { var e = donnees[k]; e._cle = k; return e; })
      .sort(function (a, b) { return (a.order || 0) - (b.order || 0) || String(a.name || '').localeCompare(String(b.name || '')); });
  }
  function tachesOuvertes(e) { return (e.tasks || []).filter(function (t) { return !t.done; }).length; }

  /* ---------- barre des espaces (tuiles carrées) ---------- */
  function rendreTuiles() {
    var nav = $('tuiles');
    nav.textContent = '';
    nav.classList.toggle('repliee', repliees);
    var moi = { cle: 'moi', nom: 'Moi', badge: 0, couleur: '#002FA7' };
    [moi].concat(espaces().map(function (e) {
      return { cle: e._cle, nom: e.name || 'Sans nom', badge: tachesOuvertes(e), couleur: e.color || '#002FA7' };
    })).forEach(function (t) {
      var b = el('button', 'tuile' + (t.cle === choisi ? ' on' : ''));
      b.type = 'button';
      b.setAttribute('aria-pressed', String(t.cle === choisi));
      var ico = el('span', 'ico');
      ico.style.background = t.couleur;
      b.appendChild(ico);
      b.appendChild(el('span', 'nom', t.nom));
      if (t.badge) b.appendChild(el('span', 'pastille-n', t.badge));
      b.addEventListener('click', function () { choisi = t.cle; vueCarte = {}; rendre(); });
      nav.appendChild(b);
    });
  }

  /* ---------- fil de conversation (Omniscient) ---------- */
  function bulle(texte, moi) {
    var d = el('div', 'bulle' + (moi ? ' moi' : ''));
    d.appendChild(el('p', '', texte));
    return d;
  }
  function pilulesRapides(liste) {
    var r = el('div', 'rapides');
    liste.forEach(function (l) {
      var b = el('button', 'pilule', l[0]);
      b.type = 'button';
      b.addEventListener('click', l[1]);
      r.appendChild(b);
    });
    return r;
  }

  function ligneItem(libelle, detail, cle, typeMarque) {
    var carte = el('div', 'item');
    var entete = el('div', 'item-tete');
    entete.appendChild(el('span', 'marque', typeMarque || '•'));
    entete.appendChild(el('span', 'item-nom', libelle || ''));
    var lab = el('label', 'coche');
    var cb = el('input');
    cb.type = 'checkbox';
    cb.checked = !!vueCarte[cle];
    cb.addEventListener('change', function () { vueCarte[cle] = cb.checked; rendre(); });
    lab.appendChild(cb);
    lab.appendChild(el('span', '', 'Vue carte'));
    entete.appendChild(lab);
    carte.appendChild(entete);
    if (vueCarte[cle] && detail) {
      /* vue « comme dans la carte de vie » : les champs de l'élément */
      detail.forEach(function (d) { carte.appendChild(el('p', 'detail', d)); });
    }
    return carte;
  }

  function rendreFil() {
    var fil = $('fil');
    fil.textContent = '';
    if (!donnees) return;

    if (choisi === 'moi') {
      var moi = donnees['meta/moi'] || {};
      var n = ['besoins', 'aspirations', 'envies'].reduce(function (s, k) { return s + (moi[k] || []).length; }, 0);
      fil.appendChild(bulle('Bonjour. Ici, tes espaces. Touche une tuile pour entrer dans un espace.', false));
      fil.appendChild(bulle('Moi : ' + n + ' élément' + (n > 1 ? 's' : '') + ' (besoins, aspirations, envies).', false));
      return;
    }

    var e = donnees[choisi];
    if (!e) { fil.appendChild(bulle('Cet espace n\'existe plus.', false)); return; }
    fil.appendChild(bulle((e.name || 'Sans nom') + ' · ' + tachesOuvertes(e) + ' tâche(s) ouverte(s).', false));

    var sections = [
      ['Tâches', (e.tasks || []).map(function (t) {
        return ['t' + t.id, t.text, [(t.done ? 'Faite' : 'À faire') + (t.due ? ' · échéance ' + t.due : '')], t.done ? '☑' : '☐'];
      })],
      ['Dates', (e.dates || []).map(function (d) {
        return ['d' + d.id, (d.date || '') + (d.time ? ' ' + d.time : ''), [d.text || ''], '◆'];
      })],
      ['Idées', (e.ideas || []).map(function (i) { return ['i' + i.id, i.text, [], '•']; })]
    ];
    sections.forEach(function (s) {
      if (!s[1].length) return;
      fil.appendChild(el('p', 'titre-section', s[0]));
      s[1].forEach(function (it) {
        fil.appendChild(ligneItem(it[1], it[2], it[0], it[3]));
      });
    });
    if (!sections.some(function (s) { return s[1].length; })) {
      fil.appendChild(bulle('Rien dans cet espace pour l\'instant.', false));
    }
  }

  function rendre() {
    rendreTuiles();
    rendreFil();
    $('fil').scrollTop = 0;
  }

  /* ---------- écrans : connexion neutre, puis carte ---------- */
  function montreConnexion(vrai) {
    $('ecran-connexion').hidden = !vrai;
    $('tuiles').hidden = vrai;
    $('replier').parentNode.hidden = vrai;
    $('fil').hidden = vrai;
    $('saisie').hidden = vrai;
    $('reglages').hidden = vrai;
    $('actu').hidden = vrai;
  }

  function charge() {
    var repo = lire('cv_repo');
    var cle = lire('cv_cle');
    if (!repo || !cle) {
      donnees = null;
      montreConnexion(true);
      return;
    }
    montreConnexion(false);
    fetch('https://api.github.com/repos/' + repo + '/contents/carte.json', {
      headers: { Authorization: 'Bearer ' + cle, Accept: 'application/vnd.github.raw+json' },
      cache: 'no-store'
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      donnees = j;
      rendre();
    }).catch(function (err) {
      donnees = null;
      montreConnexion(true);
      $('etat-connexion').textContent = 'Impossible de lire la carte (' + err.message + '). Vérifie le dépôt et la clé.';
    });
  }

  /* ---------- actions ---------- */
  $('actu').addEventListener('click', charge);
  $('m-actu').addEventListener('click', function () { fermeMenu(); charge(); });
  $('reglages').addEventListener('click', function () { montreConnexion(true); $('repo').value = lire('cv_repo'); $('cle').value = lire('cv_cle'); });
  $('m-reglages').addEventListener('click', function () { fermeMenu(); montreConnexion(true); $('repo').value = lire('cv_repo'); $('cle').value = lire('cv_cle'); });
  $('replier').addEventListener('click', function () {
    repliees = !repliees;
    this.setAttribute('aria-expanded', String(!repliees));
    rendreTuiles();
  });

  function fermeMenu() { $('menu').hidden = true; $('plus').setAttribute('aria-expanded', 'false'); }
  $('plus').addEventListener('click', function (e) {
    e.stopPropagation();
    var ouvre = $('menu').hidden;
    $('menu').hidden = !ouvre;
    $('plus').setAttribute('aria-expanded', String(ouvre));
  });
  document.addEventListener('click', function (e) { if (!$('menu').contains(e.target) && e.target !== $('plus')) fermeMenu(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fermeMenu(); });

  $('enregistrer').addEventListener('click', function () {
    var repo = $('repo').value.trim();
    var cle = $('cle').value.trim();
    if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(repo) || !cle) {
      $('etat-connexion').textContent = 'Saisis le dépôt (identifiant/nom) et la clé.';
      return;
    }
    var ok = ecrire('cv_repo', repo) && ecrire('cv_cle', cle);
    $('etat-connexion').textContent = ok ? '' : 'Impossible d\'enregistrer sur cet appareil.';
    charge();
  });

  charge();
})();
