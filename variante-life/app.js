/* Ma carte de vie, variante « style LIFE » — lecture seule pour l'instant.
   La carte se lit depuis le dépôt privé avec la clé saisie une fois sur l'appareil. Tout texte reçu est affiché avec textContent. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var donnees = null;
  var choisi = 'moi';            /* 'moi' ou la clé d'un espace */
  var repliees = false;
  document.body.classList.add('grille');
  var vueCarte = {};             /* élément coché : affichage « comme dans la carte » */
  var vueEspace = {};            /* espace coché : tout l'espace prend l'interface de la carte */

  /* identifiants : ceux que la carte a déjà rangés sur cet appareil (même origine, donc même stockage), sinon ceux saisis ici */
  function identifiants() {
    var r = json('carte-de-vie-sync');
    if (r && r.repo && r.token) return { repo: String(r.repo).trim(), cle: String(r.token).trim() };
    var c = json('connexion');
    if (c && c.depot && c.jeton) return { repo: String(c.depot).trim(), cle: String(c.jeton).trim() };
    return { repo: lire('cv_repo'), cle: lire('cv_cle') };
  }
  function json(k) { try { var v = JSON.parse(lire(k) || 'null'); return v && typeof v === 'object' ? v : null; } catch (e) { return null; } }

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

  /* image importée d'un espace (f:chemin dans le dépôt privé) : lue avec la clé, remplace l'icône de repli */
  var imagesEspace = {};
  function chargeImageTuile(ico, chemin) {
    var id = identifiants(), repo = id.repo, cle = id.cle;
    if (!repo || !cle || !chemin || chemin.indexOf('..') >= 0) return;
    var fin = function (url) {
      var img = document.createElement('img');
      /* silhouette monochrome bleue (luminance), nette à 27 px : pas de couleurs de l'image */
      var sp = document.createElement('span');
      sp.className = 'ico-image'; sp.setAttribute('aria-hidden', 'true');
      sp.style.maskImage = 'url("' + url + '")'; sp.style.webkitMaskImage = sp.style.maskImage;
      if (ico.parentNode) ico.parentNode.replaceChild(sp, ico);
    };
    if (imagesEspace[chemin]) { fin(imagesEspace[chemin]); return; }
    fetch('https://api.github.com/repos/' + repo + '/contents/' + chemin.split('/').map(encodeURIComponent).join('/'), {
      headers: { Authorization: 'Bearer ' + cle, Accept: 'application/vnd.github.raw+json' }
    }).then(function (r) { if (!r.ok) throw new Error('img'); return r.blob(); })
      .then(function (blob) { var url = URL.createObjectURL(blob); imagesEspace[chemin] = url; fin(url); })
      .catch(function () { /* icône de repli gardée */ });
  }

  /* ---------- barre des espaces (tuiles carrées) ---------- */
  function rendreTuiles() {
    var nav = $('tuiles');
    nav.textContent = '';
    var moi = { cle: 'moi', nom: 'Moi', badge: 0, couleur: '#002FA7' };
    [moi].concat(espaces().map(function (e, i) {
      return { cle: e._cle, nom: e.name || 'Sans nom', badge: tachesOuvertes(e), couleur: e.color || '#002FA7', rang: i, icone: e.icon || e.id };
    })).forEach(function (t) {
      var b = el('button', 'tuile' + (t.cle === choisi ? ' on' : '') + (t.nom.length > 14 ? ' long' : t.nom.length > 9 ? ' moyen' : ''));
      b.type = 'button';
      b.setAttribute('aria-pressed', String(t.cle === choisi));
      var ico = t.cle === 'moi' ? icone('coach') : iconeEspace(t.icone, t.rang);
      b.appendChild(ico);
      if (typeof t.icone === 'string' && t.icone.indexOf('f:') === 0) chargeImageTuile(ico, t.icone.slice(2));
      b.appendChild(el('span', 'nom' + (t.nom.length > 14 ? ' long' : t.nom.length > 9 ? ' moyen' : ''), t.nom));
      if (t.badge) b.appendChild(el('span', 'pastille-n', t.badge));
      b.addEventListener('click', function () { choisi = t.cle; vueCarte = {}; rendre(); });
      nav.appendChild(b);
    });
  }

  /* ---------- fil de conversation (Omniscient) ---------- */
  /* tracés des icônes de l'espace, repris de la carte (trait fin) */
  var ICONES_CARTE = {mains:'<g class="palm"><path d="M9 27h30v5c0 8-6 13-15 13S9 40 9 32z"/></g><rect class="fg fg1" x="10.5" y="9" width="6" height="22" rx="3"/><rect class="fg fg2" x="17.5" y="5" width="6" height="26" rx="3"/><rect class="fg fg3" x="24.5" y="6" width="6" height="25" rx="3"/><rect class="fg fg4" x="31.5" y="10" width="6" height="21" rx="3"/><rect class="th" x="38" y="22" width="6" height="15" rx="3"/><path class="w" d="M16 36c2.5-3 5-4 8-4s5.5 1 8 4c-2.5 3-5 4-8 4s-5.5-1-8-4z"/><circle cx="24" cy="36" r="2.3"/>',rameau:'<g style="transform-box:view-box;transform-origin:0 0" transform="translate(2.4 4.6) scale(.9)"><path class="ln" d="M14 45C16 32 22 20 34 5"/><path class="lf" d="M15.5 38.0Q10.2 30.8 2.7 35.7Q8.0 43.0 15.5 38.0z"/><path class="lf" d="M16.5 33.0Q24.3 36.8 27.8 28.9Q20.0 25.1 16.5 33.0z"/><path class="lf" d="M18.5 28.0Q13.8 20.3 5.9 24.6Q10.6 32.3 18.5 28.0z"/><path class="lf" d="M20.0 23.0Q28.5 24.6 29.8 16.1Q21.4 14.5 20.0 23.0z"/><path class="lf" d="M23.0 18.0Q19.0 10.0 10.8 13.6Q14.8 21.6 23.0 18.0z"/><path class="lf" d="M25.5 14.0Q34.1 14.1 34.0 5.5Q25.4 5.4 25.5 14.0z"/><path class="lf" d="M28.5 10.0Q26.0 1.4 17.2 3.5Q19.8 12.1 28.5 10.0z"/><path class="lf" d="M31.0 7.5Q39.5 6.1 37.9 -2.3Q29.4 -1.0 31.0 7.5z"/></g>',regard:'<g class="lid"><path d="M3 26C9 16 16 12 24 12s15 4 21 14c-6 10-13 14-21 14S9 36 3 26z"/><circle class="w" cx="24" cy="26" r="8"/><circle cx="24" cy="26" r="4.2"/></g><path class="ln lash" d="M24 11V5M14.5 13.5 11 8.5M33.5 13.5 37 8.5M7.5 18.5 3.5 15M40.5 18.5 44.5 15"/>',elan:'<g class="wg1"><path d="M17.6 19.6C17.4 12 22.2 6.4 30.6 4.2c.9-.2 1.5.5 1.3 1.3C30 12.6 26.4 17.2 20.4 20.4c-1 .4-2.6.2-2.8-.8z"/></g><path d="M6.4 27.4c0-3.2 2.5-5.6 5.6-5.6 1.7 0 3.1.7 4.1 1.8 4.6-1.6 11.4-1.8 17.6-.2l8.9-4.2c.9-.4 1.6.5 1.1 1.3l-4.3 6.8c-2.6 4.4-8.6 7.4-16 7.4-6.6 0-11.4-2.4-13.2-5.6-1.7-.3-3.8-.9-3.8-1.7z"/><path d="M5.4 25.2 1.8 26.9l3.6 1.1z"/><circle class="w" cx="10.6" cy="25.6" r="1.1"/>',etincelle:'<path class="s1" d="M22 3c2 12 6.5 16.5 18 19-11.5 2.5-16 7-18 19-2-12-6.5-16.5-18-19C15.5 19.5 20 15 22 3z"/><path class="s2" d="M39 30c.8 4.5 2.5 6.2 7 7-4.5.8-6.2 2.5-7 7-.8-4.5-2.5-6.2-7-7 4.5-.8 6.2-2.5 7-7z"/><path class="sp sp1" d="M40 4c.5 3 1.5 4 4.5 4.5-3 .5-4 1.5-4.5 4.5-.5-3-1.5-4-4.5-4.5 3-.5 4-1.5 4.5-4.5z"/><path class="sp sp2" d="M7 34c.5 3 1.5 4 4.5 4.5-3 .5-4 1.5-4.5 4.5-.5-3-1.5-4-4.5-4.5 3-.5 4-1.5 4.5-4.5z"/>',travail:'<g transform="translate(0 4)"><g class="amph"><g class="wg1"><path d="M21.6 18.4Q23.7 8.8 14 7.4Q11.9 17 21.6 18.4Z"/></g><g class="wg2"><path d="M26.4 18.2Q34.9 14.7 30.6 6.6Q22.1 10.1 26.4 18.2Z"/></g><ellipse cx="23.5" cy="28" rx="10.5" ry="7.5"/><path class="w" d="M17.9 22.6a1.1 1.1 0 0 1 2.2 0v10.8a1.1 1.1 0 0 1-2.2 0zM24.4 21.8a1.1 1.1 0 0 1 2.2 0v12.4a1.1 1.1 0 0 1-2.2 0z"/><circle cx="39.6" cy="26.6" r="4.4"/><circle class="w" cx="40.9" cy="25.6" r="1.3"/><path d="M10.2 28H6.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M41.2 21.4 43 16.4M38.6 21.2l-.6-4.8" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></g></g>',penderie:'<g class="dress"><path d="M18 4c1 4 3 6 6 6s5-2 6-6l4 2-3 9c2 4 9 18 12 29H5c3-11 10-25 12-29l-3-9z"/><path class="wl" d="M13 30c4 2 8-2 11 0s7 2 11 0"/></g>',immo:'<g class="vh vh1"><path d="M0 45V33l7-6 7 6v12z"/></g><g class="vh vh2"><path d="M34 45V33l7-6 7 6v12z"/></g><g class="main"><path d="M5 44V23L24 7l19 16v21z"/><path class="w" d="M19 44V34a5 5 0 0 1 10 0v10z"/><circle class="w" cx="24" cy="22" r="3.4"/></g>',facade:'<g class="bld"><path d="M9 44V17a15 15 0 0 1 30 0v27z"/><path class="w" d="M14 23v-5a5 5 0 0 1 9 0v5zM25 23v-5a5 5 0 0 1 9 0v5zM14 37v-9h9v9zM25 37v-9h9v9z"/></g><g class="pp"><circle cx="11" cy="22" r="4.5"/><path d="M4 45c0-9 3-15 7-15s7 6 7 15z"/><circle cx="24" cy="18" r="5"/><path d="M16 45c0-10 3.5-17 8-17s8 7 8 17z"/><circle cx="37" cy="22" r="4.5"/><path d="M30 45c0-9 3-15 7-15s7 6 7 15z"/></g>',pousse:'<path class="ln" d="M24 40V17"/><path d="M24 27C24 16 17 9.5 5 9.5c0 11.5 7.5 17.5 19 17.5z"/><path d="M24 21c0-9.5 6.5-15 17-15 0 9.5-6.5 15-17 15z"/><path d="M12 44c0-4.5 5-7 12-7s12 2.5 12 7z"/><g class="coin"><circle cx="37" cy="12" r="8.5"/><path class="wl" d="M40.2 8.6a5 5 0 1 0 0 6.8M32.6 11h6.2M32.6 13.6h6.2"/></g>',sport:'<path class="wv" d="M2 42c7 0 10-4 12-11 3-11 10-18 20-18 7 0 12 5 12 11-3-3-9-3-11 1 4 0 6.5 3 6.5 6.5-5-3.5-11.5 0-11.5 10.5z"/><path class="ln sea" d="M3 46c4 0 6-2 8-2s4 2 8 2 6-2 8-2 4 2 8 2 6-2 8-2"/>',coquillage:'<g class="shell"><path d="M24 8.3c3.4 0 5.4-1.8 9-1.8 5.4 0 8.5 4.2 8.5 10 0 4.8-1.8 7.8-2.9 12.3-1.4 5.8-2.2 13.2-6.3 13.2-3.2 0-3.6-5.6-5.1-9.4-.9-2.4-3.5-2.4-4.4 0-1.5 3.8-1.9 9.4-5.1 9.4-4.1 0-4.9-7.4-6.3-13.2C8.3 24.3 6.5 21.3 6.5 16.5c0-5.8 3.1-10 8.5-10 3.6 0 5.6 1.8 9 1.8z"/><path class="w" d="M12.4 15.2Q16.1 13.5 17.6 9.8Q13.9 11.5 12.4 15.2Z"/><path class="sp2" d="M42.5 3Q42.5 6 45.5 6Q42.5 6 42.5 9Q42.5 6 39.5 6Q42.5 6 42.5 3Z"/></g>',petales:'<g class="pet"><path d="M24.0 18.0Q28.2 11.5 24.0 5.0Q19.8 11.5 24.0 18.0z"/><path d="M27.5 19.1Q34.7 16.4 35.2 8.6Q27.9 11.4 27.5 19.1z"/><path d="M29.7 22.1Q37.2 24.1 42.1 18.1Q34.6 16.1 29.7 22.1z"/><path d="M29.7 25.9Q34.6 31.9 42.1 29.9Q37.2 23.9 29.7 25.9z"/><path d="M27.5 28.9Q27.9 36.6 35.2 39.4Q34.7 31.6 27.5 28.9z"/><path d="M24.0 30.0Q19.8 36.5 24.0 43.0Q28.2 36.5 24.0 30.0z"/><path d="M20.5 28.9Q13.3 31.6 12.8 39.4Q20.1 36.6 20.5 28.9z"/><path d="M18.3 25.9Q10.8 23.9 5.9 29.9Q13.4 31.9 18.3 25.9z"/><path d="M18.3 22.1Q13.4 16.1 5.9 18.1Q10.8 24.1 18.3 22.1z"/><path d="M20.5 19.1Q20.1 11.4 12.8 8.6Q13.3 16.4 20.5 19.1z"/><circle cx="24" cy="24" r="6.5"/><circle class="w" cx="24" cy="24" r="2.5"/></g>',reverie:'<path class="moon" d="M28 5a19 19 0 1 0 15 30A16 16 0 0 1 28 5z"/><path class="tw" d="M38 6c.8 4 2.3 5.4 6 6.2-3.7.8-5.2 2.2-6 6.2-.8-4-2.3-5.4-6-6.2 3.7-.8 5.2-2.2 6-6.2z"/><circle class="tw2" cx="43" cy="24" r="1.8"/>',voyage:'<g class="boat"><path d="M23 5v27H8z"/><path d="M26 9c7.5 6 11.5 13.5 12.5 23H26z"/><path d="M4 35h40c-2 5-6 8-11 8H15c-5 0-9-3-11-8z"/></g>',soleil:'<circle class="core" cx="24" cy="24" r="10"/><g class="rays"><path class="ln" d="M38.0 24.0L45.0 24.0"/><path class="ln" d="M36.6 30.1L42.9 33.1"/><path class="ln" d="M32.7 34.9L37.1 40.4"/><path class="ln" d="M27.1 37.6L28.7 44.5"/><path class="ln" d="M20.9 37.6L19.3 44.5"/><path class="ln" d="M15.3 34.9L10.9 40.4"/><path class="ln" d="M11.4 30.1L5.1 33.1"/><path class="ln" d="M10.0 24.0L3.0 24.0"/><path class="ln" d="M11.4 17.9L5.1 14.9"/><path class="ln" d="M15.3 13.1L10.9 7.6"/><path class="ln" d="M20.9 10.4L19.3 3.5"/><path class="ln" d="M27.1 10.4L28.7 3.5"/><path class="ln" d="M32.7 13.1L37.1 7.6"/><path class="ln" d="M36.6 17.9L42.9 14.9"/></g>',poisson:'<g class="fish"><path d="M4 24c7-9 15-12 23-11 6 1 10 5 13 9l5-6v24l-5-6c-3 4-7 8-13 9-8 1-16-2-23-11z"/><circle class="w" cx="13" cy="21.5" r="2"/><path class="wl" d="M22 18c3 4 3 8 0 12"/></g>',feuille:'<g class="leafy"><path d="M7.0 41.0Q35.1 37.1 34.0 8.8Q5.9 12.7 7.0 41.0z"/><path class="wl" d="M10 38L33 13"/></g>',fleur:'<g class="flw"><path d="M24.0 14.5Q30.8 8.8 24.0 3.0Q17.2 8.8 24.0 14.5z"/><path d="M26.2 15.8Q34.5 18.8 36.1 10.0Q27.7 7.0 26.2 15.8z"/><path d="M26.2 18.2Q27.7 27.0 36.1 24.0Q34.5 15.2 26.2 18.2z"/><path d="M24.0 19.5Q17.2 25.2 24.0 31.0Q30.8 25.2 24.0 19.5z"/><path d="M21.8 18.2Q13.5 15.2 11.9 24.0Q20.3 27.0 21.8 18.2z"/><path d="M21.8 15.8Q20.3 7.0 11.9 10.0Q13.5 18.8 21.8 15.8z"/><circle class="w" cx="24" cy="18" r="3.5"/><path class="ln" d="M24 26v19M24 38c-3-4-8-5-12-3M24 34c3-4 8-5 12-3"/></g>',livre:'<path d="M5 9c7-2.5 13-2 18 2v30c-5-4-11-4.5-18-2z"/><path class="pg" d="M43 9c-7-2.5-13-2-18 2v30c5-4 11-4.5 18-2z"/>',sante:'<g class="hb"><path d="M24 42S5 30 5 17A10 10 0 0 1 24 12a10 10 0 0 1 19 5c0 13-19 25-19 25z"/><path class="wl" d="M11 24h8l3-6 4 11 3-5h8"/></g>',amis:'<g class="p1"><circle cx="16" cy="15" r="7"/><path d="M3 42c0-9 6-14 13-14s13 5 13 14z"/></g><g class="p2"><circle cx="33.5" cy="17" r="6"/><path d="M31 42c0-5-1-9-3.5-12 1.8-1 3.8-2 5.8-2C40 28 45 33 45 42z"/></g>',cheveux:'<g class="hair"><path d="M8.6 13.6C11 8 17.6 6.4 23.4 8.2c4.6 1.4 8.6 1.2 12.6-.8-2.2 4.4-6.6 6.4-11.6 6-4.2-.4-7.4.6-9.4 3.2z"/></g><circle cx="11.4" cy="17.4" r="4.4"/><path d="M14.6 22.6 6.2 27.8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><g class="queue"><path d="M13.6 21C17.4 18.6 22 18.8 26 20.8c3.8 1.9 6.6 4.8 9.6 6.2l1.4.6c-2.4 3.6-6.6 4.4-10.6 2.6-3.6-1.6-6.4-3.6-10.4-4.6-2.6-.6-3.6-2.6-2.4-5.6z"/><circle class="w" cx="24" cy="24.6" r=".9"/><circle class="w" cx="28.2" cy="26.8" r=".9"/><circle class="w" cx="31.6" cy="28.6" r=".9"/><path d="M36.8 28.2Q44.4 29.3 45 21.6Q37.4 20.5 36.8 28.2Z"/><path d="M37.2 29.6Q37.2 36.8 44.4 36.4Q44.4 29.2 37.2 29.6Z"/></g><path class="sea" d="M6 40c3 0 4.5-2 7-2s4 2 7 2 4.5-2 7-2 4 2 7 2 4.5-2 7-2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',habitudes:'<g class="ring"><circle cx="24.0" cy="9.0" r="3.4"/><circle cx="34.6" cy="13.4" r="3.4"/><circle cx="39.0" cy="24.0" r="3.4"/><circle cx="34.6" cy="34.6" r="3.4"/><circle cx="24.0" cy="39.0" r="3.4"/><circle cx="13.4" cy="34.6" r="3.4"/><circle cx="9.0" cy="24.0" r="3.4"/><circle cx="13.4" cy="13.4" r="3.4"/></g><circle cx="24" cy="24" r="6.5"/>',cuisine:'<g class="steam"><path d="M12.6 7.4c-1.4-1.2-1.4-2.6 0-3.8s1.4-2.6 0-3.8M35.4 7.4c-1.4-1.2-1.4-2.6 0-3.8s1.4-2.6 0-3.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" transform="translate(0 3)"/></g><g class="lid2"><path d="M10 18.4c0-4.6 6.2-7.6 14-7.6s14 3 14 7.6z"/><circle cx="24" cy="9.2" r="2"/></g><path d="M5.6 19.8h36.8v3.2H5.6z"/><path d="M8 22.4h32v9.6a10 10 0 0 1-10 10H18a10 10 0 0 1-10-10z"/><path d="M8.4 25.4H4.6a2.3 2.3 0 0 0 0 4.6h3.8zM39.6 25.4h3.8a2.3 2.3 0 0 1 0 4.6h-3.8z"/><path class="w" d="M13 30.2h22v2H13z"/>',star:'<g class="spin"><path d="M24 4l5.5 12 13 1.6-9.6 9 2.5 13L24 33l-11.4 6.6 2.5-13-9.6-9 13-1.6z"/></g>'};
  var ICONES_CARTE_L = {cuisine:'<g class="steam"><path d="M12.6 7.4c-1.4-1.2-1.4-2.6 0-3.8s1.4-2.6 0-3.8M35.4 7.4c-1.4-1.2-1.4-2.6 0-3.8s1.4-2.6 0-3.8" transform="translate(0 3)"/></g><g class="lid2"><path d="M10.5 17.8c0-4.4 6-7.3 13.5-7.3s13.5 2.9 13.5 7.3z"/><circle cx="24" cy="7.4" r="1.2"/></g><path d="M6.5 20.8h35"/><path d="M8.4 23.4h31.2v8.8a9.6 9.6 0 0 1-9.6 9.6H18a9.6 9.6 0 0 1-9.6-9.6z"/><path d="M6.6 26H5a2 2 0 0 0 0 4h1.6M41.4 26H43a2 2 0 0 1 0 4h-1.6"/>',habitudes:'<g class="ring"><circle cx="24.0" cy="9.0" r="3"/><circle cx="34.6" cy="13.4" r="3"/><circle cx="39.0" cy="24.0" r="3"/><circle cx="34.6" cy="34.6" r="3"/><circle cx="24.0" cy="39.0" r="3"/><circle cx="13.4" cy="34.6" r="3"/><circle cx="9.0" cy="24.0" r="3"/><circle cx="13.4" cy="13.4" r="3"/></g><circle cx="24" cy="24" r="6.5"/><path d="M21.3 24.2l1.9 1.9 3.6-3.8"/>',cheveux:'<g class="hair"><path d="M15.4 11.2C18.6 8 23 7.4 27 8.6c3.8 1.2 6.6 1 9.6-.6-2 3.6-5.6 5.2-9.6 4.8-3.6-.4-6.4.2-9 1.8z"/></g><circle cx="11.4" cy="17.4" r="4.2"/><path d="M13 24 6.4 28"/><g class="queue"><path d="M17.4 19.8C20.6 18.4 23.6 18.8 26.6 20.4c3.6 2 6.2 4.6 9 6l1.4.6c-2.4 3.6-6.6 4.4-10.6 2.6-3.6-1.6-6.2-3.4-9.8-4.4-2.2-.6-2.2-3.2.8-5.4z"/><circle cx="25.6" cy="24.2" r=".6"/><circle cx="29.8" cy="26.6" r=".6"/><path d="M39 27.2Q45.9 27.9 45.6 21Q38.7 20.3 39 27.2Z"/><path d="M39.2 29.8Q38.8 36 45 35.8Q45.4 29.6 39.2 29.8Z"/></g><path class="sea" d="M6 40c3 0 4.5-2 7-2s4 2 7 2 4.5-2 7-2 4 2 7 2 4.5-2 7-2"/>',mains:'<path class="palm" d="M9 29.5v2.5c0 7.5 6 13 14 13s14-5.5 14-13v-2.5"/><path class="fg fg1" d="M10.1 27V14.5a2.4 2.4 0 0 1 4.8 0V27"/><path class="fg fg2" d="M16.8 27V9.5a2.4 2.4 0 0 1 4.8 0V27"/><path class="fg fg3" d="M23.5 27V10.5a2.4 2.4 0 0 1 4.8 0V27"/><path class="fg fg4" d="M30.2 27V15.5a2.4 2.4 0 0 1 4.8 0V27"/><path class="th" d="M39.5 34.5V26a2.5 2.5 0 0 1 5 0v4.5c0 3.4-1.4 6.1-3.9 8"/><path d="M16.5 37.2c2.2-2.6 4.3-3.8 6.5-3.8s4.3 1.2 6.5 3.8c-2.2 2.6-4.3 3.8-6.5 3.8s-4.3-1.2-6.5-3.8z"/><circle cx="23" cy="37.2" r="1.4"/>',rameau:'<g style="transform-box:view-box;transform-origin:0 0" transform="translate(2.4 4.6) scale(.9)"><path class="ln" d="M15 45C17.5 32 23 19.5 32.5 8.5"/><path class="lf" d="M18.5 38.9Q25.2 42.3 29 35.8Q22.2 32.4 18.5 38.9Z"/><path class="lf" d="M16.6 31.7Q17.5 24.4 10.3 23.6Q9.4 30.8 16.6 31.7Z"/><path class="lf" d="M22.8 27.2Q28.2 31.7 32.2 26Q26.8 21.4 22.8 27.2Z"/><path class="lf" d="M22.2 19.6Q24.7 13.3 18 11.9Q15.5 18.2 22.2 19.6Z"/><path class="lf" d="M29.1 16.1Q32.9 21.4 37.1 16.4Q33.4 11.1 29.1 16.1Z"/><path class="lf" d="M33.9 6.8Q40 6.8 39.2 0.8Q33.1 0.8 33.9 6.8Z"/></g>',regard:'<g class="lid"><path d="M4 26C10 17 16.5 13 24 13s14 4 20 13c-6 9-12.5 13-20 13S10 35 4 26z"/><circle cx="24" cy="26" r="7"/><circle cx="24" cy="26" r="2.8"/></g><path class="ln lash" d="M10.4 15.3L8.1 12.3M37.6 15.3L39.9 12.3M17.2 11.7L16 8.1M30.8 11.7L32 8.1M24 10.6L24 6.8"/>',elan:'<g class="wg1"><path d="M17.6 19.6C17.4 12 22.2 6.4 30.6 4.2c.9-.2 1.5.5 1.3 1.3C30 12.6 26.4 17.2 20.4 20.4c-1 .4-2.6.2-2.8-.8z"/></g><path d="M6.4 27.4c0-3.2 2.5-5.6 5.6-5.6 1.7 0 3.1.7 4.1 1.8 4.6-1.6 11.4-1.8 17.6-.2l8.9-4.2c.9-.4 1.6.5 1.1 1.3l-4.3 6.8c-2.6 4.4-8.6 7.4-16 7.4-6.6 0-11.4-2.4-13.2-5.6-1.7-.3-3.8-.9-3.8-1.7z"/><path d="M5.4 25.2 1.8 26.9l3.6 1.1z"/><circle cx="10.6" cy="25.6" r=".7"/>',etincelle:'<path class="s1" d="M22 4c2 11.5 6.5 16 17.5 18.5C28.5 25 24 29.5 22 41c-2-11.5-6.5-16-17.5-18.5C15.5 20 20 15.5 22 4z"/><path class="s2" d="M39 30.5c.8 4.2 2.4 5.8 6.5 6.5-4.1.7-5.7 2.3-6.5 6.5-.8-4.2-2.4-5.8-6.5-6.5 4.1-.7 5.7-2.3 6.5-6.5z"/><path class="sp sp1" d="M40 4c.5 3 1.5 4 4.5 4.5-3 .5-4 1.5-4.5 4.5-.5-3-1.5-4-4.5-4.5 3-.5 4-1.5 4.5-4.5z"/><path class="sp sp2" d="M7 34c.5 3 1.5 4 4.5 4.5-3 .5-4 1.5-4.5 4.5-.5-3-1.5-4-4.5-4.5 3-.5 4-1.5 4.5-4.5z"/>',travail:'<g transform="translate(0 4)"><g class="amph"><g class="wg1"><path d="M21.6 18.4Q23.7 8.8 14 7.4Q11.9 17 21.6 18.4Z"/></g><g class="wg2"><path d="M26.4 18.2Q34.9 14.7 30.6 6.6Q22.1 10.1 26.4 18.2Z"/></g><ellipse cx="23.5" cy="28" rx="10.5" ry="7.5"/><path d="M19 23.3v9.4M25.5 22.8v10.4"/><circle cx="40.2" cy="27" r="3.9"/><circle cx="41" cy="26.2" r=".7"/><path d="M11.2 28H7.4"/><path d="M41.4 21.4 43 16.4M38.4 21.2l-.6-4.8"/></g></g>',penderie:'<g class="dress"><path d="M18 4c1 4 3 6 6 6s5-2 6-6l4 2-3 9c2 4 9 18 12 29H5c3-11 10-25 12-29l-3-9z"/><path d="M13.5 31c4 2 7.5-2 10.5 0s6.5 2 10.5 0"/></g>',immo:'<g class="vh vh1"><path d="M1 45V34.5l6-5 6 5V45"/></g><g class="vh vh2"><path d="M35 45V34.5l6-5 6 5V45"/></g><g class="main"><path d="M6 44.5V23L24 7.5 42 23v21.5"/><path d="M19.5 44.5V36a4.5 4.5 0 0 1 9 0v8.5"/><path d="M21.5 19.5h5v5h-5z"/></g>',facade:'<g class="bld"><path d="M9 44.5V17a15 15 0 0 1 30 0v27.5"/><path d="M14.5 24v-5.5a4 4 0 0 1 8 0V24zM25.5 24v-5.5a4 4 0 0 1 8 0V24zM14.5 38v-8h8v8zM25.5 38v-8h8v8z"/></g><g class="pp"><circle cx="10" cy="25" r="3.8"/><path d="M4.5 45c0-7.5 2.4-12.5 5.5-12.5s5.5 5 5.5 12.5"/><circle cx="24" cy="20" r="4.2"/><path d="M18 45c0-9 2.6-14.5 6-14.5s6 5.5 6 14.5"/><circle cx="38" cy="25" r="3.8"/><path d="M32.5 45c0-7.5 2.4-12.5 5.5-12.5s5.5 5 5.5 12.5"/></g>',pousse:'<path class="ln" d="M24 34.5V9"/><path d="M22 26C22 16.5 16 11 6 11c0 9.8 6.3 15 16 15z"/><path d="M26 20.5c0-8.6 6-13.5 15-13.5 0 8.6-6 13.5-15 13.5z"/><path d="M12 44c0-4.5 5-7 12-7s12 2.5 12 7z"/><g class="coin"><circle cx="37" cy="12" r="8"/><circle cx="37" cy="12" r="4.8"/></g>',sport:'<path class="wv" d="M3 41.5c7 0 10-4 12-11 3-11 10-18 20-18 7 0 12 5 12 11-3-3-9-3-11 1 4 0 6.5 3 6.5 6.5-5-3.5-11.5 0-11.5 10.5z"/><path class="ln sea" d="M3 46c4 0 6-2 8-2s4 2 8 2 6-2 8-2 4 2 8 2 6-2 8-2"/>',coquillage:'<g class="shell"><path d="M24 8.3c3.4 0 5.4-1.8 9-1.8 5.4 0 8.5 4.2 8.5 10 0 4.8-1.8 7.8-2.9 12.3-1.4 5.8-2.2 13.2-6.3 13.2-3.2 0-3.6-5.6-5.1-9.4-.9-2.4-3.5-2.4-4.4 0-1.5 3.8-1.9 9.4-5.1 9.4-4.1 0-4.9-7.4-6.3-13.2C8.3 24.3 6.5 21.3 6.5 16.5c0-5.8 3.1-10 8.5-10 3.6 0 5.6 1.8 9 1.8z"/><path d="M12.8 15c.5-2.4 2-3.8 4.2-4.3"/><path class="sp2" d="M43.2 2.4000000000000004Q43.2 5.2 46.0 5.2Q43.2 5.2 43.2 8.0Q43.2 5.2 40.400000000000006 5.2Q43.2 5.2 43.2 2.4000000000000004Z"/></g>',petales:'<g class="pet"><path d="M24 16.8Q30.2 10.7 24 4.5Q17.8 10.7 24 16.8Z"/><path d="M29.1 18.9Q37.8 18.9 37.8 10.2Q29.1 10.2 29.1 18.9Z"/><path d="M31.2 24Q37.4 30.2 43.5 24Q37.4 17.8 31.2 24Z"/><path d="M29.1 29.1Q29.1 37.8 37.8 37.8Q37.8 29.1 29.1 29.1Z"/><path d="M24 31.2Q17.8 37.4 24 43.5Q30.2 37.4 24 31.2Z"/><path d="M18.9 29.1Q10.2 29.1 10.2 37.8Q18.9 37.8 18.9 29.1Z"/><path d="M16.8 24Q10.6 17.8 4.5 24Q10.7 30.2 16.8 24Z"/><path d="M18.9 18.9Q18.9 10.2 10.2 10.2Q10.2 18.9 18.9 18.9Z"/><circle cx="24" cy="24" r="4.4"/><circle cx="24" cy="24" r="1.3"/></g>',reverie:'<path class="moon" d="M27 6a18.5 18.5 0 1 0 15 29.5A15.5 15.5 0 0 1 27 6z"/><path class="tw" d="M38.5 5.5c.8 3.8 2.2 5.2 5.8 6-3.6.8-5 2.2-5.8 6-.8-3.8-2.2-5.2-5.8-6 3.6-.8 5-2.2 5.8-6z"/><circle class="tw2" cx="44" cy="23.5" r="1.4"/>',voyage:'<g class="boat"><path d="M22.5 5v26.5H8z"/><path d="M26 9c7.5 6 11.5 13.5 12.5 22.5H26z"/><path d="M4 35h40c-2 5-6 8-11 8H15c-5 0-9-3-11-8z"/></g>',soleil:'<circle class="core" cx="24" cy="24" r="8.5"/><g class="rays"><path d="M37 24L43.5 24M35.3 30.5L40.9 33.8M30.5 35.3L33.8 40.9M24 37L24 43.5M17.5 35.3L14.3 40.9M12.7 30.5L7.1 33.8M11 24L4.5 24M12.7 17.5L7.1 14.2M17.5 12.7L14.2 7.1M24 11L24 4.5M30.5 12.7L33.8 7.1M35.3 17.5L40.9 14.2"/></g>',poisson:'<g class="fish"><path d="M4 24c7-9 15-12 23-11 6 1 10 5 13 9l5-6v24l-5-6c-3 4-7 8-13 9-8 1-16-2-23-11z"/><circle cx="13" cy="21.5" r="1.8"/><path d="M22 18c3 4 3 8 0 12"/></g>',feuille:'<g class="leafy"><path d="M7 41Q35.1 37.1 34 8.8 5.9 12.7 7 41z"/><path d="M13.5 34.5 29 16"/></g>',fleur:'<g class="flw"><path d="M24 10.7Q29.2 7.1 24 3.5Q18.8 7.1 24 10.7Z"/><path d="M28.2 13.1Q33.9 15.8 34.4 9.5Q28.7 6.8 28.2 13.1Z"/><path d="M28.2 17.9Q28.7 24.2 34.4 21.5Q33.9 15.2 28.2 17.9Z"/><path d="M24 20.3Q18.8 23.9 24 27.5Q29.2 23.9 24 20.3Z"/><path d="M19.8 17.9Q14.1 15.2 13.6 21.5Q19.3 24.2 19.8 17.9Z"/><path d="M19.8 13.1Q19.3 6.8 13.6 9.5Q14.1 15.8 19.8 13.1Z"/><circle cx="24" cy="15.5" r="2.4"/><path d="M24 30v15"/><path d="M22 40.5Q19.5 33.4 12 34.5Q14.5 41.6 22 40.5Z"/><path d="M26 36.5Q33.5 37.6 36 30.5Q28.5 29.4 26 36.5Z"/></g>',livre:'<path d="M5 9c7-2.5 13-2 18 2v30c-5-4-11-4.5-18-2z"/><path class="pg" d="M43 9c-7-2.5-13-2-18 2v30c5-4 11-4.5 18-2z"/>',sante:'<g class="hb"><path d="M24 42S5 30 5 17A10 10 0 0 1 24 12a10 10 0 0 1 19 5c0 13-19 25-19 25z"/><path d="M11 24.5h7.5l3-6 4 11 3-5h8.5"/></g>',amis:'<g class="p1"><circle cx="15" cy="15" r="6"/><path d="M4 42c0-8.5 5-13 11-13s11 4.5 11 13"/></g><g class="p2"><circle cx="35.5" cy="19" r="5"/><path d="M29 42c0-7 2.8-11 6.5-11s6.5 4 6.5 11"/></g>',star:'<g class="spin"><path d="M24 4l5.5 12 13 1.6-9.6 9 2.5 13L24 33l-11.4 6.6 2.5-13-9.6-9 13-1.6z"/></g>'};

  /* icônes de LIFE (tracés statiques, une par tuile) */
  var ICONES = {
    general: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/>',
    travail: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 12h18"/>',
    metamorphose: '<path d="M12 21v-9"/><path d="M12 12c0-4 2.5-7 7-7 0 4.5-3 7-7 7z"/><path d="M12 15c0-3-2-5.5-6-5.5 0 3.5 2.5 5.5 6 5.5z"/>',
    patrimoine: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
    quotidien: '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M12 3v3"/>',
    voyage: '<path d="M10.5 13.5L3 11l1.5-1.5 8 1 4-4c1-1 3-1.5 3.5-1s0 2.5-1 3.5l-4 4 1 8L14.5 22 12 14.5l-3 3V20l-1.5 1.5-1-3-3-1L6 16h2.5z"/>',
    experts: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5M22 9v6"/>',
    comite: '<path d="M3 21h18M5 21V10M19 21V10M9 21v-7M15 21v-7M2 10l10-6 10 6z"/>',
    brainstorm: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    coach: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'
  };
  var ORDRE_ICONES = ['general', 'travail', 'patrimoine', 'quotidien', 'voyage', 'experts', 'comite', 'brainstorm', 'coach', 'metamorphose'];

  /* icône en trait fin, comme dans LIFE (aucune couleur d'espace) */
  /* icône de la carte pour un espace (clé connue seulement), sinon icône LIFE */
  function iconeEspace(cle, rang) {
    var tables = [ICONES_CARTE_L, ICONES_CARTE];
    for (var i = 0; i < tables.length; i++) {
      if (typeof cle === 'string' && Object.prototype.hasOwnProperty.call(tables[i], cle)) return icone(null, tables[i][cle]);
    }
    return icone(ORDRE_ICONES[rang % ORDRE_ICONES.length]);
  }

  function icone(cle, corps) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    /* icônes de la carte : grille 48 ; icônes LIFE : grille 24 */
    svg.setAttribute('viewBox', corps ? '0 0 48 48' : '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', corps ? '1.6' : '1.75');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', 'ico');
    /* tracés constants du code (aucune donnée de la carte) */
    svg.innerHTML = corps || ICONES[cle] || ICONES.general;
    return svg;
  }

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
    if ((vueCarte[cle] || vueEspace[choisi]) && detail) {
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
    var coche = el('label', 'coche coche-espace');
    var cbE = el('input');
    cbE.type = 'checkbox';
    cbE.checked = !!vueEspace[choisi];
    cbE.addEventListener('change', function () { vueEspace[choisi] = cbE.checked; rendre(); });
    coche.appendChild(cbE);
    coche.appendChild(el('span', '', 'Vue carte de tout l\'espace'));
    fil.appendChild(coche);
    if (vueEspace[choisi] && e.notes) {
      var rc = el('div', 'item');
      rc.appendChild(el('p', 'titre-section', 'Récap'));
      rc.appendChild(el('p', 'detail', e.notes));
      fil.appendChild(rc);
    }

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
    var id = identifiants(), repo = id.repo, cle = id.cle;
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
    document.body.classList.toggle('grille', !repliees);
    this.setAttribute('aria-expanded', String(!repliees));
    this.setAttribute('aria-label', repliees ? 'Déplier les espaces' : 'Replier les espaces');
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

/* hors ligne et mises à jour : le service worker n'était jamais enregistré. Une nouvelle version recharge la page toute seule. */
(function () {
  if (!('serviceWorker' in navigator)) return;
  var avaitControle = !!navigator.serviceWorker.controller;
  var recharge = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (!avaitControle || recharge) return;
    recharge = true;
    location.reload();
  });
  navigator.serviceWorker.register('sw.js').then(function (reg) { reg.update(); }).catch(function () { /* hors service : l'app marche sans */ });
})();
