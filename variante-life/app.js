/* Ma carte de vie, variante « style LIFE » : lecture de la carte (dépôt privé, clé saisie une fois).
   Lecture seule pour l'instant : rien n'est écrit dans carte.json. Tout texte reçu est affiché avec textContent. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var etat = $('etat');
  var donnees = null;
  var espaceCourant = null;
  var ongletCourant = 'taches';

  function lire(cle) { try { return localStorage.getItem(cle) || ''; } catch (e) { return ''; } }
  function ecrire(cle, val) { try { localStorage.setItem(cle, val); return true; } catch (e) { return false; } }

  var bureau = window.matchMedia('(min-width: 900px) and (pointer: fine)');

  function montre(ecran) {
    var accueil = ecran === 'ecran-espace' && bureau.matches ? true : ecran === 'ecran-accueil';
    $('ecran-accueil').hidden = !accueil;
    $('ecran-espace').hidden = ecran !== 'ecran-espace';
    $('ecran-reglages').hidden = ecran !== 'ecran-reglages';
    $('reglages').hidden = ecran === 'ecran-reglages';
    $('actu').hidden = ecran === 'ecran-reglages';
  }

  function el(tag, cls, texte) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (texte !== undefined && texte !== null) n.textContent = String(texte);
    return n;
  }

  function espaces() {
    if (!donnees) return [];
    return Object.keys(donnees).filter(function (k) {
      return k.indexOf('espaces/') === 0 && donnees[k] && !donnees[k]._del;
    }).map(function (k) {
      var e = donnees[k];
      e._cle = k;
      return e;
    }).sort(function (a, b) {
      return (a.order || 0) - (b.order || 0) || String(a.name || '').localeCompare(String(b.name || ''));
    });
  }

  function compte(e) {
    var taches = (e.tasks || []).filter(function (t) { return !t.done; }).length;
    var dates = (e.dates || []).length;
    return taches + ' tâche' + (taches > 1 ? 's' : '') + ' · ' + dates + ' date' + (dates > 1 ? 's' : '');
  }

  function rendreAccueil() {
    var liste = $('espaces');
    liste.textContent = '';
    var moi = donnees && donnees['meta/moi'];
    var nbMoi = moi ? ['besoins', 'aspirations', 'envies'].reduce(function (s, k) { return s + ((moi[k] || []).length); }, 0) : 0;
    $('moi-sous').textContent = nbMoi + ' élément' + (nbMoi > 1 ? 's' : '');
    espaces().forEach(function (e) {
      var b = el('button', 'tuile');
      b.type = 'button';
      b.style.borderColor = '#002FA7';
      var pastille = el('span', 'pastille');
      pastille.style.background = e.color || '#002FA7';
      b.appendChild(pastille);
      b.appendChild(el('b', '', e.name || 'Sans nom'));
      b.appendChild(el('small', '', compte(e)));
      b.addEventListener('click', function () { ouvre(e._cle); });
      liste.appendChild(b);
    });
    if (!liste.childNodes.length) etat.textContent = 'Aucun espace pour l\'instant.';
  }

  function ouvre(cle) {
    espaceCourant = cle;
    montre('ecran-espace');
    rendreEspace();
    window.scrollTo(0, 0);
  }

  function rendreEspace() {
    var e = donnees[espaceCourant];
    if (!e) { montre('ecran-accueil'); return; }
    $('espace-titre').textContent = e.name || 'Sans nom';
    $('espace-sous').textContent = compte(e);
    var onglets = $('espace-onglets');
    onglets.textContent = '';
    [['taches', 'Tâches'], ['dates', 'Dates'], ['idees', 'Idées'], ['rubriques', 'Rubriques']].forEach(function (o) {
      var b = el('button', 'pilule' + (o[0] === ongletCourant ? ' on' : ''), o[1]);
      b.type = 'button';
      b.addEventListener('click', function () { ongletCourant = o[0]; rendreEspace(); });
      onglets.appendChild(b);
    });
    var c = $('espace-contenu');
    c.textContent = '';
    var lignes = [];
    if (ongletCourant === 'taches') {
      (e.tasks || []).forEach(function (t) { lignes.push([t.done ? '☑' : '☐', t.text, t.due]); });
    } else if (ongletCourant === 'dates') {
      (e.dates || []).forEach(function (d) { lignes.push(['◆', (d.date || '') + (d.time ? ' ' + d.time : ''), d.text]); });
    } else if (ongletCourant === 'idees') {
      (e.ideas || []).forEach(function (i) { lignes.push(['•', i.text, '']); });
    } else {
      (e.rub || []).forEach(function (r) {
        lignes.push(['▸', r.name, '']);
        (r.items || []).forEach(function (it) { lignes.push([it.done ? '☑' : '☐', it.text, '']); });
      });
    }
    if (!lignes.length) { c.appendChild(el('p', 'aide', 'Rien ici pour l\'instant.')); return; }
    lignes.forEach(function (l) {
      var row = el('div', 'ligne');
      row.appendChild(el('span', 'marque', l[0]));
      row.appendChild(el('span', 'texte', l[1] || ''));
      if (l[2]) row.appendChild(el('small', 'fin', l[2]));
      c.appendChild(row);
    });
  }

  function charge() {
    var repo = lire('cv_repo');
    var cle = lire('cv_cle');
    if (!repo || !cle) {
      /* écran neutre, comme LIFE : seulement la proposition de se connecter, aucun contenu de la carte */
      donnees = null;
      $('repo').value = repo;
      $('cle').value = cle;
      $('etat-reglages').textContent = '';
      montre('ecran-reglages');
      return;
    }
    etat.textContent = 'Chargement de ta carte…';
    fetch('https://api.github.com/repos/' + repo + '/contents/carte.json', {
      headers: { Authorization: 'Bearer ' + cle, Accept: 'application/vnd.github.raw+json' },
      cache: 'no-store'
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      donnees = j;
      etat.textContent = '';
      rendreAccueil();
    }).catch(function (err) {
      etat.textContent = 'Impossible de lire la carte (' + err.message + '). Vérifie le dépôt et la clé dans Réglages.';
    });
  }

  $('reglages').addEventListener('click', function () {
    $('repo').value = lire('cv_repo');
    $('cle').value = lire('cv_cle');
    $('etat-reglages').textContent = '';
    montre('ecran-reglages');
  });
  $('retour').addEventListener('click', function () { montre('ecran-accueil'); });
  $('retour-espace').addEventListener('click', function () { montre('ecran-accueil'); });
  $('actu').addEventListener('click', charge);
  $('enregistrer').addEventListener('click', function () {
    var repo = $('repo').value.trim();
    var cle = $('cle').value.trim();
    if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(repo) || !cle) {
      $('etat-reglages').textContent = 'Saisis le dépôt (identifiant/nom) et la clé.';
      return;
    }
    var ok = ecrire('cv_repo', repo) && ecrire('cv_cle', cle);
    $('etat-reglages').textContent = ok ? 'Enregistré sur cet appareil.' : 'Impossible d\'enregistrer sur cet appareil.';
    montre('ecran-accueil');
    charge();
  });
  $('moi').addEventListener('keydown', function (e) { if (e.key === 'Enter') { ouvre('meta/moi'); } });
  $('moi').addEventListener('click', function () { if (donnees) { ouvre('meta/moi'); } });

  charge();
})();
