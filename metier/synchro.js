/* App « Métier » — synchro entre appareils, par un fichier réservé à l'app dans le dépôt privé déjà lié à la carte.
   Le dépôt et le jeton viennent de la connexion commune (Connexion.etat()) : aucune clé n'est écrite ici. Sans connexion, ou hors ligne, l'app
   marche avec les données de l'appareil. Aucun fichier existant du dépôt n'est touché : un seul fichier, `metier/metier-v1.json`, créé s'il manque.
   Jamais d'écrasement sans contrôle : l'écriture porte le `sha` lu ; si le fichier distant a changé depuis la dernière synchro ET que cet appareil a
   changé aussi, rien n'est écrit : le conflit est montré et l'utilisatrice choisit. Rien n'est dit « synchronisé » tant que GitHub n'a pas répondu bon.
   Rangement local : une seule clé, « metier-sync » (dernier sha vu, empreinte de ce qui a été synchronisé, date). */
var MetierSynchro = (function () {
  'use strict';
  var CLE = 'metier-sync', CHEMIN = 'metier/metier-v1.json', MAX = 900000;   // au-delà de ~1 Mo GitHub ne renvoie plus le contenu : refus net, pas de demi-synchro
  var API = 'https://api.github.com/repos/';

  function canon(t) { return JSON.stringify(JSON.parse(t)); }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function empreinte(t) { return crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)).then(hex); }
  function enBase64(t) { var u = new TextEncoder().encode(t), s = ''; for (var i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s); }
  function deBase64(b) { var s = atob(String(b).replace(/\s+/g, '')), u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new TextDecoder().decode(u); }

  function noteLue() { try { var v = JSON.parse(localStorage.getItem(CLE) || 'null'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
  function noteEcrire(o) { try { localStorage.setItem(CLE, JSON.stringify(o)); } catch (e) { /* stockage indisponible : la prochaine synchro redemandera */ } }

  /* Décision pure (testée à part) : { distant: null | { sha, hash }, localHash, baseHash, syncSha, videHash } -> action */
  function planifier(p) {
    if (!p.distant) return 'creer';
    if (p.distant.hash === p.localHash) return 'a_jour';
    var distantChange = !(p.syncSha && p.syncSha === p.distant.sha);
    var localChange = p.baseHash ? p.localHash !== p.baseHash : p.localHash !== p.videHash;
    if (!distantChange && !localChange) return 'a_jour';
    if (!distantChange) return p.localHash === p.videHash ? 'conflit' : 'envoyer';   // un état vide (après « Tout effacer ») n'écrase jamais le distant sans choix
    if (!localChange) return 'recevoir';
    return 'conflit';
  }

  function erreur(code) { var e = new Error(code); e.code = code; return e; }
  function appel(depot, jeton, chemin, methode, corps) {
    var opt = { method: methode || 'GET', headers: { Authorization: 'Bearer ' + jeton, Accept: 'application/vnd.github+json' }, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' };
    if (corps) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(corps); }
    return fetch(API + depot + chemin, opt).catch(function () { throw erreur('reseau'); });
  }
  function statut(r) {
    if (r.status === 401 || r.status === 403) return erreur('refus');
    if (r.status === 409 || r.status === 422) return erreur('conflit');
    if (r.status === 404) return erreur('depot');
    return erreur(r.status >= 500 ? 'service' : 'inconnu');
  }
  /* lit le fichier distant : null s'il n'existe pas (le dépôt, lui, répond) ; sinon { sha, texte } */
  function lire(c) {
    return appel(c.depot, c.jeton, '/contents/' + CHEMIN).then(function (r) {
      if (r.status === 404) {   // fichier absent, ou dépôt introuvable / droits insuffisants : on distingue
        return appel(c.depot, c.jeton, '').then(function (d) { if (d.ok) return null; throw statut(d); });
      }
      if (!r.ok) throw statut(r);
      return r.json().then(function (j) {
        if (!j || typeof j.sha !== 'string' || typeof j.content !== 'string' || j.encoding !== 'base64' || !j.content) throw erreur('gros');
        var texte; try { texte = canon(deBase64(j.content)); } catch (e) { throw erreur('illisible'); }
        return { sha: j.sha, texte: texte };
      }, function () { throw erreur('inconnu'); });
    });
  }
  function ecrire(c, texte, sha) {
    var t = canon(texte); if (t.length > MAX) return Promise.reject(erreur('gros'));
    var corps = { message: 'Métier : synchro', content: enBase64(t) }; if (sha) corps.sha = sha;
    return appel(c.depot, c.jeton, '/contents/' + CHEMIN, 'PUT', corps).then(function (r) {
      if (!r.ok) throw statut(r);
      return r.json().then(function (j) { if (!j || !j.content || typeof j.content.sha !== 'string') throw erreur('inconnu'); return j.content.sha; }, function () { throw erreur('inconnu'); });
    });
  }
  function noter(sha, texte) {
    return empreinte(canon(texte)).then(function (h) { noteEcrire({ sha: sha, base: h, quand: new Date().toISOString() }); });
  }

  /* connexion : { depot, jeton } de la connexion commune, ou null avec la raison */
  function connexion() {
    var e = {}; try { e = Connexion.etat(); } catch (x) { e = {}; }
    if (e.depot && e.jeton) return { c: { depot: e.depot, jeton: e.jeton } };
    // Appareil neuf : la connexion commune range dépôt et jeton « en attente » (rangement « connexion », jamais copiés dans la synchro de la carte).
    // Métier les lit là, pour son seul fichier : rien n'est écrit ailleurs, le jeton n'est jamais affiché.
    var att = null; try { att = Connexion.enAttente(); } catch (x) { att = null; }
    if (att && att.depot && att.jeton) return { c: { depot: att.depot, jeton: att.jeton } };
    return { raison: 'absente' };
  }

  /* Un tour : lit, décide, et (sauf conflit) agit. Rend { action, texteDistant?, shaDistant?, texteLocal } ; ne remplace jamais rien d'ici sans le dire. */
  function synchroniser(texteLocal, texteVide) {
    var cx = connexion(); if (!cx.c) return Promise.reject(erreur(cx.raison));
    var c = cx.c, note = noteLue();
    return lire(c).then(function (d) {
      return Promise.all([empreinte(canon(texteLocal)), empreinte(canon(texteVide)), d ? empreinte(d.texte) : null]).then(function (h) {
        var plan = planifier({ distant: d ? { sha: d.sha, hash: h[2] } : null, localHash: h[0], baseHash: note.base || '', syncSha: note.sha || '', videHash: h[1] });
        if (plan === 'creer') return ecrire(c, texteLocal, '').then(function (sha) { return noter(sha, texteLocal).then(function () { return { action: 'cree' }; }); });
        if (plan === 'envoyer') return ecrire(c, texteLocal, d.sha).then(function (sha) { return noter(sha, texteLocal).then(function () { return { action: 'envoye' }; }); });
        if (plan === 'a_jour') return noter(d.sha, d.texte).then(function () { return { action: 'a_jour' }; });
        return { action: plan === 'recevoir' ? 'recevoir' : 'conflit', texteDistant: d.texte, shaDistant: d.sha };
      });
    });
  }
  /* Choix explicite de l'utilisatrice après un conflit : remplacer le distant par cet appareil (avec le sha vu), ou noter qu'on a repris le distant. */
  function garderCetAppareil(texteLocal, shaDistant) {
    var cx = connexion(); if (!cx.c) return Promise.reject(erreur(cx.raison));
    return ecrire(cx.c, texteLocal, shaDistant).then(function (sha) { return noter(sha, texteLocal); });
  }
  function repris(texteDistant, shaDistant) { return noter(shaDistant, texteDistant); }

  var MESSAGES = {
    absente: 'Pas connecté : la synchro n\'est pas disponible. L\'app marche avec les données de cet appareil. Connecte-toi plus bas.',
    refus: 'GitHub refuse le jeton ou n\'y donne pas accès (jeton à refaire, ou droits sur le dépôt). Rien n\'a été envoyé ni reçu : tu n\'es PAS synchronisé.',
    depot: 'Dépôt introuvable, ou le jeton n\'y a pas accès. Rien n\'a été envoyé ni reçu : tu n\'es PAS synchronisé.',
    conflit: 'Le fichier distant a changé pendant l\'envoi : rien n\'a été écrasé. Relance la synchro. Tu n\'es PAS encore synchronisé.',
    reseau: 'GitHub est injoignable (hors ligne ?). L\'app marche avec les données de cet appareil ; tu n\'es PAS synchronisé.',
    service: 'GitHub a un souci. Rien n\'a été envoyé ni reçu : tu n\'es PAS synchronisé. Réessaie plus tard.',
    gros: 'Le fichier est trop gros pour la synchro (environ 1 Mo au plus). Rien n\'a été envoyé ni reçu : exporte plutôt un fichier.',
    illisible: 'Le fichier distant n\'est pas lisible. Rien n\'a été changé ici ni là-bas.',
    inconnu: 'La synchro a échoué (réponse inattendue). Rien n\'a été changé : tu n\'es PAS synchronisé.'
  };
  function message(x) { return MESSAGES[x && x.code] || MESSAGES.inconnu; }

  return { CLE: CLE, CHEMIN: CHEMIN, planifier: planifier, synchroniser: synchroniser, garderCetAppareil: garderCetAppareil, repris: repris, message: message, note: noteLue, canon: canon };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = MetierSynchro;
