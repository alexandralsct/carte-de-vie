/* App « Métier » — logique pure (aucun accès à la page ni au stockage) : calculs, import/export.
   Chargée par index.html et par les tests (tests/test_metier.py) avec le même fichier.
   Règle de la maison : un chiffre inconnu reste null (jamais 0 inventé) ; un chiffre sans source est marqué « supposé ». */
var Metier = (function () {
  'use strict';

  var VERSION = 1;
  var CLE_STOCKAGE = 'metier-v1';

  function nombre(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = typeof v === 'number' ? v : parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
    return isFinite(n) ? n : null;
  }
  function arrondi(n, d) { if (n === null) return null; var f = Math.pow(10, d || 0); return Math.round(n * f) / f; }

  /* ---------- Réglages de calcul (hypothèses, marquées « supposé » dans la page) ---------- */
  var REGLAGES_DEFAUT = { heuresParJour: 7, semainesAn: 45 };

  /* ---------- Fiche effective = fiche de base + tes modifications ---------- */
  function fusionnerPiste(base, modif) {
    modif = modif || {};
    var p = {};
    var k;
    for (k in base) p[k] = base[k];
    for (k in modif) if (k !== 'heuresInv' && k !== 'droitEntree') p[k] = modif[k];
    p.heuresInv = {};
    for (k in (base.heuresInv || {})) p.heuresInv[k] = base.heuresInv[k];
    for (k in (modif.heuresInv || {})) p.heuresInv[k] = modif.heuresInv[k];
    p.droitEntree = {};
    for (k in (base.droitEntree || {})) p.droitEntree[k] = base.droitEntree[k];
    for (k in (modif.droitEntree || {})) p.droitEntree[k] = modif.droitEntree[k];
    /* une valeur saisie par toi n'est plus « supposée » */
    p.supposes = (base.supposes || []).filter(function (c) { return !(c in modif); });
    return p;
  }

  /* ---------- Compteur (I84 à I89, I114 à I117) ---------- */
  function semainesAn(p, g) { var s = nombre(p.semainesAn); return s !== null ? s : g.semainesAn; }

  /* heures facturées par semaine : saisies, ou jours par semaine × heures par jour (supposé) */
  function heuresVisibles(p, g) {
    var h = nombre(p.heuresVisSemaine);
    if (h !== null) return h;
    var j = nombre(p.joursSemaine);
    return j === null ? null : j * g.heuresParJour;
  }
  var CHAMPS_INVISIBLES = ['prospection', 'devis', 'admin', 'trajets', 'relances', 'chargeMentale'];
  function heuresInvisibles(p) {
    var total = 0, renseigne = false;
    CHAMPS_INVISIBLES.forEach(function (c) {
      var v = nombre((p.heuresInv || {})[c]);
      if (v !== null) { total += v; renseigne = true; }
    });
    return { total: total, renseigne: renseigne };
  }

  /* revenu annuel pour le scénario 'bas' ou 'haut' : montant direct (salaire) ou tarif journalier × jours par an.
     Rend null si on ne peut pas calculer. 'brut' = salaire brut ; 'ca' = chiffre d'affaires (avant charges, impôts). */
  function revenuAnnuel(p, g, scenario) {
    var sc = scenario === 'haut' ? 'haut' : 'bas';
    var direct = nombre(sc === 'haut' ? p.revenuHaut : p.revenuBas);
    var montant = null, nature = p.nature === 'brut' ? 'brut' : 'ca';
    if (direct !== null) montant = direct;
    else {
      var t = nombre(sc === 'haut' ? p.tarifHaut : p.tarifBas), j = nombre(p.joursSemaine);
      if (t !== null && j !== null) { montant = t * j * semainesAn(p, g); nature = 'ca'; }
    }
    if (montant === null) return null;
    var c = nombre(p.chargesPct), apres = montant;
    if (c !== null && nature === 'ca') apres = montant * (1 - c / 100);
    return { montant: montant, nature: nature, apresCharges: apres, chargesPrises: c !== null && nature === 'ca' };
  }

  /* chiffres d'une piste pour un scénario ; null pour ce qui ne peut pas être calculé */
  function chiffrer(p, g, scenario) {
    var rev = revenuAnnuel(p, g, scenario);
    var hv = heuresVisibles(p, g), inv = heuresInvisibles(p), sem = semainesAn(p, g);
    var r = { revenu: rev, heuresVisibles: hv, heuresInvisibles: inv.total, invisiblesRenseignees: inv.renseigne,
      heuresTotal: null, tauxAtteint: null, eurosHeureVie: null };
    if (hv !== null) r.heuresTotal = hv + inv.total;
    if (rev && hv !== null && hv > 0) r.tauxAtteint = rev.apresCharges / (hv * sem);
    if (rev && r.heuresTotal !== null && r.heuresTotal > 0) r.eurosHeureVie = rev.apresCharges / (r.heuresTotal * sem);
    return r;
  }

  /* I85 : heures de vie par semaine nécessaires pour couvrir un besoin annuel, avec le rendement de la piste */
  function heuresPourBesoin(chiffres, besoinAnnuel, sem) {
    var b = nombre(besoinAnnuel);
    if (b === null || !chiffres.eurosHeureVie) return null;
    return b / chiffres.eurosHeureVie / sem;
  }

  var ORDRE_DISTANCE = { totale: 1, principale: 0.8, partielle: 0.4, surplace: 0, inconnue: null };
  var ORDRE_URGENCES = { aucune: 1, rares: 0.5, frequentes: 0, inconnu: null, '': null };

  /* I117 : mois sans revenu et marge (sans marge saisie, aucune piste n'est « au-delà ») */
  function auDelaMarge(p, marge) {
    var m = nombre(p.moisSansRevenu), g = nombre(marge);
    return m !== null && g !== null && m > g;
  }

  /* I117 : revenu de chaque mois sur un an : rien pendant les mois sans revenu, puis le revenu mensuel de la piste */
  function courbeRevenus(p, g, scenario, nbMois) {
    var n = nbMois || 12, rev = revenuAnnuel(p, g, scenario);
    if (!rev) return null;
    var mensuel = rev.apresCharges / 12, sans = nombre(p.moisSansRevenu), out = [];
    if (sans === null) sans = 0;
    for (var i = 0; i < n; i++) out.push(i < sans ? 0 : mensuel);
    return out;
  }

  /* Plafond d'heures (I88, facultatif) : une piste est au-dessus si ses heures totales par semaine dépassent le plafond */
  function auDessusPlafond(chiffres, plafond) {
    var pl = nombre(plafond);
    return pl !== null && chiffres.heuresTotal !== null && chiffres.heuresTotal > pl;
  }

  /* Classement par euros par heure (I87, I84) : les pistes chiffrées d'abord, du plus haut au plus bas ; puis les pistes
     au-dessus du plafond ; puis celles qu'on ne sait pas encore chiffrer. cle = 'vie' | 'taux' | 'revenu' */
  function classer(pistes, g, scenario, cle, plafond) {
    var lignes = pistes.map(function (p, i) {
      var c = chiffrer(p, g, scenario);
      var valeur = cle === 'taux' ? c.tauxAtteint : cle === 'revenu' ? (c.revenu ? c.revenu.apresCharges : null) : c.eurosHeureVie;
      var groupe = valeur === null ? 2 : (auDessusPlafond(c, plafond) ? 1 : 0);
      return { piste: p, chiffres: c, valeur: valeur, groupe: groupe, ordre: i };
    });
    lignes.sort(function (a, b) {
      if (a.groupe !== b.groupe) return a.groupe - b.groupe;
      if (a.groupe < 2 && b.valeur !== a.valeur) return b.valeur - a.valeur;
      return a.ordre - b.ordre;
    });
    var rang = 0;
    lignes.forEach(function (l) { l.rang = l.groupe === 0 ? ++rang : null; });
    return lignes;
  }


  /* ---------- Classement unique (refonte du 05/11) : une seule base, l'euro par heure ----------
     Chaque piste reçoit, quand c'est possible, UN chiffre en euros par heure et la NATURE de ce chiffre :
       « brut »        salaire brut annuel (revenuBas) ÷ (heures par semaine × semaines par an) ;
       « facturé HT »  tarif journalier HT ÷ heures par journée, ou tarif horaire HT donné tel quel.
     Les deux natures ne se comparent pas directement (charges, impôts, jours sans mission) : l'écran les marque sur chaque ligne et propose un filtre.
     Toute conversion (35 h, 45 semaines, 7 h par journée) est « supposée », sauf heures saisies par toi. Une piste sans chiffre n'a jamais de valeur
     inventée : elle va à part, en bas. */
  function baseHoraire(p, g) {
    g = g || REGLAGES_DEFAUT;
    var hj = nombre(g.heuresParJour) || REGLAGES_DEFAUT.heuresParJour, sa = semainesAn(p, g);
    var eh = nombre(p.euroHeureBas);
    if (eh !== null && /factur/i.test(p.euroHeureNature || '')) return { valeur: eh, nature: 'facturé HT', supposee: false, calcul: 'tarif horaire facturé hors taxes, relevé tel quel' };
    var revenu = nombre(p.revenuBas);
    if (revenu !== null && p.nature !== 'ca') {
      var hv = heuresVisibles(p, g);
      if (hv === null || hv <= 0) return null;
      var saisi = nombre(p.heuresVisSemaine) !== null;
      return { valeur: revenu / (hv * sa), nature: 'brut', supposee: !saisi,
        calcul: 'salaire brut ' + Math.round(revenu) + ' € par an ÷ (' + (Math.round(hv * 10) / 10) + ' h par semaine × ' + sa + ' semaines)' };
    }
    var tarif = nombre(p.tarifBas);
    if (tarif !== null && tarif > 0) return { valeur: tarif / hj, nature: 'facturé HT', supposee: true,
      calcul: 'tarif ' + Math.round(tarif) + ' € par jour hors taxes ÷ ' + hj + ' h par journée' };
    return null;
  }
  function profilEmploi(p, base) {
    if (base) return base.nature === 'brut' ? 'salariee' : 'independante';
    if (p.nature === 'brut') return 'salariee';
    if (nombre(p.tarifBas) !== null || nombre(p.euroHeureBas) !== null) return 'independante';
    return 'inconnu';
  }
  function entreeAuDela(p, marge) {
    var m = nombre(marge); if (m === null) return false;
    var de = p.droitEntree || {}, e = nombre(de.mois), s = nombre(p.moisSansRevenu);
    return (e !== null && e > m) || (s !== null && s > m);
  }
  /* mentions courtes de chaque ligne (au plus trois) : { texte, ton } avec ton = ok | ex | non | neutre */
  function mentionsPiste(p, marge) {
    var out = [], d = p.distance, sup = (p.supposes || []).indexOf('distance') >= 0;
    if ((d === 'totale' || d === 'principale') && !sup) out.push({ texte: 'à distance', ton: 'ok' });
    else if (d === 'surplace') out.push({ texte: 'sur place', ton: 'non' });
    else out.push({ texte: d === 'partielle' ? 'en partie à distance : à vérifier' : 'à distance : à vérifier', ton: 'ex' });
    if (entreeAuDela(p, marge)) out.push({ texte: 'au-delà de ta marge', ton: 'non' });
    else if (/^(imm[ée]diat|court)/i.test(p.delai || '') || (nombre(p.moisSansRevenu) !== null && nombre(p.moisSansRevenu) <= 1)) out.push({ texte: 'démarrage rapide', ton: 'ok' });
    var man = String(p.manque || '');
    if (/exp[ée]rience/i.test(man)) out.push({ texte: 'expérience manquante', ton: 'ex' });
    else if (man && out.length < 3) out.push({ texte: 'à compléter', ton: 'neutre' });
    return out.slice(0, 3);
  }
  /* la prochaine vérification d'une piste : une seule phrase, dans l'ordre de ce qui change le plus le classement */
  function prochaineVerification(p, g, marge) {
    var b = baseHoraire(p, g), sup = (p.supposes || []).indexOf('distance') >= 0;
    if (!b) return nombre(p.revenuBas) !== null ? 'Renseigner les jours ou les heures par semaine de « ' + p.nom + ' » : le salaire est connu, pas les heures.' : 'Chercher un tarif ou un salaire sourcé pour « ' + p.nom + ' » (rien n\'est estimé en attendant).';
    if (p.distance === 'inconnue' || sup || p.distance === 'partielle') return 'Vérifier auprès d\'une personne qui exerce, ou dans une annonce ouverte, la part réellement à distance de « ' + p.nom + ' » : aucune source ne la donne.';
    if (entreeAuDela(p, marge)) return 'Trouver comment démarrer « ' + p.nom + ' » en moins de ' + nombre(marge) + ' mois, ou le garder en parallèle d\'une autre piste.';
    if (p.manque) return 'Combler ce qui manque pour « ' + p.nom + ' » : ' + p.manque + '.';
    if (b.supposee) return 'Relever les heures réelles d\'une vraie mission de « ' + p.nom + ' » (les heures du calcul sont supposées).';
    return 'Demander un devis ou une offre réelle pour « ' + p.nom + ' » et comparer au chiffre relevé.';
  }
  /* pistes : fiches fusionnées ; filtre : 'tout' | 'independante' | 'salariee' | 'porteurs' ; renvoie { classees, sansChiffre } */
  function classementPrincipal(pistes, g, marge, filtre) {
    var f = filtre || 'tout', lignes = [];
    (pistes || []).forEach(function (p, i) {
      if (p.statut === 'elimine') return;
      var b = baseHoraire(p, g), profil = profilEmploi(p, b);
      if (f === 'porteurs') { if (!p.porteur) return; }
      else if (f !== 'tout' && profil !== 'inconnu' && profil !== f) return;
      lignes.push({ piste: p, base: b, profil: profil, mentions: mentionsPiste(p, marge), ordre: i });
    });
    var ch = lignes.filter(function (l) { return l.base; }).sort(function (a, b) { return b.base.valeur - a.base.valeur || a.ordre - b.ordre; });
    ch.forEach(function (l, k) { l.rang = k + 1; });
    return { classees: ch, sansChiffre: lignes.filter(function (l) { return !l.base; }) };
  }

  /* ---------- Grille de critères refaite (I46, I89) : poids à toi, critères inconnus laissés de côté ---------- */
  var CRITERES_GRILLE = [
    { id: 'euros', nom: 'Euros par heure de vie' },
    { id: 'plafond', nom: 'Heures plafonnables' },
    { id: 'urgences', nom: 'Urgences subies (moins = mieux)' },
    { id: 'arret', nom: 'Possibilité de s\'arrêter' },
    { id: 'distance', nom: 'À distance' },
    { id: 'marge', nom: 'Dans ta marge sans revenu' }
  ];
  function poidsDefaut() { var o = {}; CRITERES_GRILLE.forEach(function (c) { o[c.id] = 1; }); return o; }

  function valeursGrille(p, chiffres, maxEurosHeure, marge) {
    var v = {};
    v.euros = (chiffres.eurosHeureVie !== null && maxEurosHeure > 0) ? chiffres.eurosHeureVie / maxEurosHeure : null;
    v.plafond = p.plafonnable === 'oui' ? 1 : p.plafonnable === 'non' ? 0 : null;
    v.urgences = ORDRE_URGENCES[p.urgences || ''] === undefined ? null : ORDRE_URGENCES[p.urgences || ''];
    v.arret = p.arreter === 'oui' ? 1 : p.arreter === 'non' ? 0 : null;
    var d = ORDRE_DISTANCE[p.distance || 'inconnue'];
    v.distance = d === undefined ? null : d;
    var m = nombre(p.moisSansRevenu);
    var g = nombre(marge);
    v.marge = (m === null || g === null) ? null : (m <= g ? 1 : 0);
    return v;
  }

  /* note sur 100 = moyenne pondérée des critères connus ; connus = nombre de critères sur lesquels elle repose */
  function noteGrille(valeurs, poids) {
    var somme = 0, total = 0, connus = 0;
    CRITERES_GRILLE.forEach(function (c) {
      var w = nombre(poids && poids[c.id]);
      if (w === null || w < 0) w = 0;
      if (valeurs[c.id] !== null && valeurs[c.id] !== undefined) { connus++; somme += w * valeurs[c.id]; total += w; }
    });
    return { note: total > 0 ? Math.round(100 * somme / total) : null, connus: connus, sur: CRITERES_GRILLE.length };
  }

  function grille(pistes, g, scenario, poids, marge) {
    var chiffres = pistes.map(function (p) { return chiffrer(p, g, scenario); });
    var maxEH = 0;
    chiffres.forEach(function (c) { if (c.eurosHeureVie !== null && c.eurosHeureVie > maxEH) maxEH = c.eurosHeureVie; });
    return pistes.map(function (p, i) {
      var vals = valeursGrille(p, chiffres[i], maxEH, marge);
      var n = noteGrille(vals, poids);
      return { piste: p, valeurs: vals, note: n.note, connus: n.connus, sur: n.sur };
    });
  }

  /* ---------- Bouquet : plusieurs pistes côte à côte (I31, I45) ---------- */
  /* parts : [{ piste, joursSemaine }] → revenu annuel, heures par semaine, euros par heure de vie du bouquet.
     Les pistes sans chiffre sont comptées dans « inconnues » et ne sont pas remplacées par un 0 silencieux. */
  function bouquet(parts, g, scenario) {
    var revenu = 0, heures = 0, inconnues = [], sem = g.semainesAn;
    parts.forEach(function (x) {
      var p = {};
      for (var k in x.piste) p[k] = x.piste[k];
      var j = nombre(x.joursSemaine);
      if (j !== null) p.joursSemaine = j;
      var c = chiffrer(p, g, scenario);
      if (!c.revenu || c.heuresTotal === null) { inconnues.push(x.piste.id || x.piste.nom); return; }
      revenu += c.revenu.apresCharges;
      heures += c.heuresTotal;
    });
    return { revenu: revenu, heuresSemaine: heures, eurosHeureVie: heures > 0 ? revenu / (heures * sem) : null, inconnues: inconnues };
  }

  /* ---------- Cahier des charges : missions passées (I123) ---------- */
  /* chaque mission : { nom, valeur (€), heures } → euros par heure ; null si non calculable */
  function tauxMissions(missions) {
    return (missions || []).map(function (m) {
      var v = nombre(m.valeur), h = nombre(m.heures);
      return { nom: m.nom, eurosHeure: (v !== null && h !== null && h > 0) ? v / h : null };
    });
  }

  /* ---------- Chiffrage d'une reconversion (I50) ---------- */
  function chiffrageReconversion(e) {
    var forma = nombre(e.coutFormation), sans = nombre(e.moisSansRevenu), perdu = nombre(e.revenuMensuelPerdu),
        patri = nombre(e.patrimoine), cout = nombre(e.coutVieMensuel);
    var revenusPerdus = (sans !== null && perdu !== null) ? sans * perdu : null;
    var total = null;
    if (forma !== null || revenusPerdus !== null) total = (forma || 0) + (revenusPerdus || 0);
    var reste = (total !== null && patri !== null) ? Math.max(0, total - patri) : null;
    var tenables = (patri !== null && cout !== null && cout > 0) ? patri / cout : null;
    return { revenusPerdus: revenusPerdus, total: total, resteAFinancer: reste, moisTenables: tenables };
  }

  /* ---------- Dates (calendrier, points, fin) ---------- */
  function analyserDate(s) {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    var d = new Date(s + 'T00:00:00Z');
    return isNaN(d.getTime()) ? null : d;
  }
  function formaterDate(d) { return d.toISOString().slice(0, 10); }
  function ajouterMois(s, n) {
    var d = analyserDate(s); if (!d) return null;
    var j = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + n);
    var dernier = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(j, dernier));
    return formaterDate(d);
  }
  function ajouterJours(s, n) { var d = analyserDate(s); if (!d) return null; d.setUTCDate(d.getUTCDate() + n); return formaterDate(d); }
  function joursEntre(a, b) {
    var x = analyserDate(a), y = analyserDate(b);
    return (x && y) ? Math.round((y.getTime() - x.getTime()) / 86400000) : null;
  }
  /* I78 : jours restants jusqu'à la date de fin (négatif si dépassée) */
  function joursRestants(fin, aujourdhui) { return joursEntre(aujourdhui, fin); }
  /* I55 : prochain point = dernier point + 6 mois ; I56 : prochaine réécriture = dernière + 7 ans */
  function prochainPoint(dernier) { return ajouterMois(dernier, 6); }
  function prochaineReecriture(derniere) { return ajouterMois(derniere, 84); }

  /* I38 : un test dure deux semaines à partir de son début */
  function finTest(debut) { return ajouterJours(debut, 14); }
  /* Verdict d'un test : seuils fixés avant (verrouillés), mesures saisies après.
     sens '>=' : la mesure doit être au moins égale à la valeur ; '<=' : au plus. */
  function verdictTest(t, aujourdhui) {
    if (!t.fixeLe) return { etat: 'seuils_a_fixer', texte: 'Seuils pas encore fixés' };
    var seuils = t.seuils || [];
    if (!seuils.length) return { etat: 'seuils_a_fixer', texte: 'Aucun seuil' };
    var mesures = 0, atteints = 0;
    seuils.forEach(function (s) {
      var m = nombre(s.mesure), v = nombre(s.valeur);
      if (m === null || v === null) return;
      mesures++;
      if (s.sens === '<=' ? m <= v : m >= v) atteints++;
    });
    var fin = finTest(t.debut);
    var passee = fin && aujourdhui ? joursEntre(aujourdhui, fin) <= 0 : false;
    if (mesures < seuils.length) return { etat: passee ? 'a_mesurer' : 'en_cours', texte: passee ? 'Deux semaines écoulées : mesures à saisir' : 'En cours', atteints: atteints, mesures: mesures, total: seuils.length };
    return atteints === seuils.length
      ? { etat: 'atteints', texte: 'Tous les seuils atteints', atteints: atteints, mesures: mesures, total: seuils.length }
      : { etat: 'non_atteints', texte: atteints + ' seuil(s) atteint(s) sur ' + seuils.length, atteints: atteints, mesures: mesures, total: seuils.length };
  }

  /* I53 : date de dernière nouvelle d'un carnet de bord */
  function derniereNouvelle(entrees) {
    var d = null;
    (entrees || []).forEach(function (e) { if (analyserDate(e.date) && (d === null || e.date > d)) d = e.date; });
    return d;
  }

  /* I121 : bilan de l'expérience de trois mois à partir du relevé hebdomadaire */
  function bilanExperience(semaines) {
    var h = 0, e = 0, n = 0, hEuros = 0;
    (semaines || []).forEach(function (s) {
      var hh = nombre(s.heures), ee = nombre(s.euros);
      if (hh !== null) { h += hh; n++; }
      if (ee !== null) e += ee;
      if (hh !== null && ee !== null) hEuros += hh;
    });
    return { heures: h, euros: e, semainesRenseignees: n, eurosHeure: hEuros > 0 ? e / hEuros : null,
      heuresParSemaine: n > 0 ? h / n : null };
  }

  /* ---------- Calendrier (I51) : années où un virage est possible ---------- */
  /* evenements : [{ nom, debut:'AAAA-MM', fin:'AAAA-MM', bloquant }] → pour chaque année, les événements qui la touchent */
  function anneeDe(s) { var m = /^(\d{4})-(\d{2})$/.exec(s || ''); return m ? parseInt(m[1], 10) : null; }
  function calendrierAnnees(evenements, de, a) {
    var out = [];
    for (var an = de; an <= a; an++) {
      var touches = [], bloque = false;
      (evenements || []).forEach(function (ev) {
        var d = anneeDe(ev.debut), f = anneeDe(ev.fin) || d;
        if (d === null) return;
        if (an >= d && an <= f) { touches.push(ev.nom); if (ev.bloquant) bloque = true; }
      });
      out.push({ annee: an, evenements: touches, possible: !bloque });
    }
    return out;
  }

  /* ---------- Générateur et croisements (I28 à I30) ---------- */
  /* I28 : toutes les paires (porte-greffe × greffon), sans paire d'un élément avec lui-même */
  /* Seuls de vrais métiers comptent : une petite activité d'appoint (revente d'objets, garde d'animaux…) ne devient ni piste ni croisement. */
  var PETITE_ACTIVITE = /vinted|leboncoin|vide[- ]?grenier|revente|(?:vente|vendre|revendre)\s+(?:de\s+|des\s+|d[’']|mes\s+|ses\s+)?(?:v[êe]tements?|habits|fringues)|garde\s+(?:de|d[’'])\s*(?:chats?|chiens?|animaux)|(?:cat|dog|pet)[- ]?sit|promen(?:ade|er)\s+(?:de\s+|des\s+)?chiens?/i;
  function estPetiteActivite(texte) { return PETITE_ACTIVITE.test(String(texte || '')); }
  function sansPetitesActivites(liste) { return (liste || []).filter(function (x) { return !estPetiteActivite(x); }); }
  function croiser(portes, greffons) {
    portes = sansPetitesActivites(portes); greffons = sansPetitesActivites(greffons);
    var out = [];
    portes.forEach(function (a) { greffons.forEach(function (b) { if (a !== b) out.push({ porteGreffe: a, greffon: b }); }); });
    return out;
  }
  /* I30 : « J'aide [qui] à [quoi] grâce à [mon mélange] » ; ne remplit que ce qui est donné */
  function phraseGenerateur(qui, quoi, melange) {
    return 'J\'aide ' + (qui || '…') + ' à ' + (quoi || '…') + ' grâce à ' + (melange || '…') + '.';
  }
  function combinaisonsGenerateur(quiListe, quoiListe, melangeListe) {
    quiListe = sansPetitesActivites(quiListe); quoiListe = sansPetitesActivites(quoiListe); melangeListe = sansPetitesActivites(melangeListe);
    var out = [];
    quiListe.forEach(function (q) { quoiListe.forEach(function (w) { melangeListe.forEach(function (m) { out.push({ qui: q, quoi: w, melange: m, phrase: phraseGenerateur(q, w, m) }); }); }); });
    return out;
  }


  /* ---------- Récolte (lot 3) : ce que tes données disent déjà de ton travail, ligne par ligne ----------
     Format du fichier : { format:'metier-recolte', version:1, genere, origine, lignes:[{ id, famille, texte, source, date, etat, idee?, note? }] }.
     Une ligne sans source n'existe pas. */
  var FORMAT_RECOLTE = 'metier-recolte';
  var VERSION_RECOLTE = 1;
  var FAMILLES_RECOLTE = [
    { id: 'veux', nom: 'Ce que je veux du travail', idee: 'I2' },
    { id: 'gestes', nom: 'Ce que tu as fait de tes mains et de ta tête', idee: 'I8' },
    { id: 'attirances', nom: 'Ce que tu gardes depuis des années', idee: 'I4' },
    { id: 'lectures', nom: 'Ce que tu lis jusqu\'au bout', idee: 'I5' },
    { id: 'echanges', nom: 'Ce que tu écris', idee: 'I6' },
    { id: 'refus', nom: 'Ce que tu refuses', idee: 'I7' },
    { id: 'reves', nom: 'Tes rêves et tes envies', idee: 'I3' },
    { id: 'activites', nom: 'Ce que tu fais déjà', idee: 'I9 I10' },
    { id: 'famille', nom: 'Les métiers de ta famille', idee: 'I11' },
    { id: 'cout', nom: 'Ce que ta vie coûte', idee: 'I85' }
  ];
  var ETATS_RECOLTE = ['propose', 'garde', 'ecarte'];
  var MAX_LIGNES_RECOLTE = 800;

  function rTxt(v) { return v === undefined || v === null ? '' : String(v).replace(/\s+/g, ' ').trim(); }
  function rNorm(v) { return rTxt(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function rCouper(s, n) { s = rTxt(s); return s.length <= n ? s : s.slice(0, Math.max(0, n - 1)).replace(/\s+\S*$/, '') + '…'; }
  function rDate(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(rTxt(v));
    if (!m) return '';
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? m[1] + '-' + m[2] + '-' + m[3] : '';
  }
  function rHash(s, graine) {
    var h = graine >>> 0, o = unescape(encodeURIComponent(String(s)));
    for (var i = 0; i < o.length; i++) { h ^= o.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return ('00000000' + h.toString(16)).slice(-8);
  }
  function idLigne(famille, source, texte) {
    var base = rNorm(famille) + '|' + rNorm(source) + '|' + rNorm(texte);
    return 'R-' + rHash(base, 2166136261) + rHash(base, 3141592653);
  }
  function familleRecolte(id) { return FAMILLES_RECOLTE.filter(function (f) { return f.id === id; })[0] || null; }

  /* Une ligne brute -> { ligne } ou { rejet }. Sans source, elle n'existe pas. */
  function ligneRecolte(x) {
    if (!x || typeof x !== 'object' || Array.isArray(x)) return { rejet: 'pas une ligne' };
    var famille = rTxt(x.famille);
    if (!familleRecolte(famille)) return { rejet: 'famille inconnue' };
    var texte = rCouper(x.texte, 400);
    if (texte.length < 3) return { rejet: 'texte vide' };
    var source = rCouper(x.source, 200);
    if (source.length < 6) return { rejet: 'sans source' };
    var l = { id: rTxt(x.id) || idLigne(famille, source, texte), famille: famille, texte: texte, source: source, date: rDate(x.date),
      etat: ETATS_RECOLTE.indexOf(rTxt(x.etat)) >= 0 ? rTxt(x.etat) : 'propose' };
    if (/^I\d{1,3}$/.test(rTxt(x.idee))) l.idee = rTxt(x.idee);
    var note = rCouper(x.note, 240);
    if (note) l.note = note;
    return { ligne: l };
  }
  function nettoyerLignes(liste) {
    var vus = {}, out = [];
    (Array.isArray(liste) ? liste : []).slice(0, MAX_LIGNES_RECOLTE).forEach(function (x) {
      var r = ligneRecolte(x);
      if (r.ligne && !vus[r.ligne.id]) { vus[r.ligne.id] = true; out.push(r.ligne); }
    });
    return out;
  }

  /* Texte d'un fichier de récolte -> { ok, lignes, rejetees:[{n,raison}] } ou { ok:false, erreur }. Ne modifie rien. */
  function lireRecolte(texte) {
    var o, vide = { ok: false, lignes: [], rejetees: [] };
    function non(e) { vide.erreur = e; return vide; }
    if (typeof texte !== 'string' || !texte.trim()) return non('Le fichier est vide.');
    try { o = JSON.parse(texte); } catch (e) { return non('Ce n\'est pas un fichier JSON lisible.'); }
    if (!o || typeof o !== 'object' || Array.isArray(o) || o.format !== FORMAT_RECOLTE) return non('Ce fichier n\'est pas une récolte (format « ' + FORMAT_RECOLTE + ' » attendu).');
    if (!(+o.version >= 1) || +o.version > VERSION_RECOLTE) return non('Version de récolte inconnue (' + rTxt(o.version) + ').');
    if (!Array.isArray(o.lignes)) return non('Le fichier ne contient pas de liste de lignes.');
    var lignes = [], rejetees = [], vus = {};
    o.lignes.slice(0, MAX_LIGNES_RECOLTE).forEach(function (x, k) {
      var r = ligneRecolte(x);
      if (r.rejet) { rejetees.push({ n: k + 1, raison: r.rejet }); return; }
      if (vus[r.ligne.id]) return;
      vus[r.ligne.id] = true; lignes.push(r.ligne);
    });
    return { ok: true, lignes: lignes, rejetees: rejetees, genere: rDate(o.genere), origine: rTxt(o.origine) };
  }

  /* Ajoute les lignes lues à celles que tu as déjà : une ligne déjà connue garde SON état (ce que tu as décidé ne revient jamais à « à relire »). */
  function fusionnerRecolte(existantes, lues) {
    var base = nettoyerLignes(existantes), ids = {};
    base.forEach(function (l) { ids[l.id] = true; });
    var ajoutees = 0, deja = 0;
    (lues || []).forEach(function (l) {
      if (ids[l.id]) { deja++; return; }
      ids[l.id] = true; base.push(l); ajoutees++;
    });
    return { lignes: base.slice(0, MAX_LIGNES_RECOLTE), ajoutees: ajoutees, deja: deja };
  }

  /* Change l'état d'une ligne (rend une nouvelle liste). */
  function decider(lignes, id, etat) {
    if (ETATS_RECOLTE.indexOf(etat) < 0) return lignes;
    return lignes.map(function (l) { if (l.id !== id) return l; var c = {}; for (var k in l) c[k] = l[k]; c.etat = etat; return c; });
  }

  /* Ligne que tu écris toi-même (famille « veux »...) : sa source, c'est toi et le jour. Gardée d'office. */
  function ligneSaisie(famille, texte, jour) {
    var r = ligneRecolte({ famille: famille, texte: texte, source: 'Toi · saisi dans l\'app le ' + rDate(jour), date: jour, etat: 'garde' });
    return r.ligne || null;
  }

  function comptesRecolte(lignes) {
    var c = { propose: 0, garde: 0, ecarte: 0 };
    (lignes || []).forEach(function (l) { if (c[l.etat] !== undefined) c[l.etat]++; });
    return c;
  }

  /* I5 : « les fiches qui te marquent » = un marquage fait par toi, ligne par ligne (rien n'est deviné). Rend un nouvel objet. */
  function marquer(marques, id) {
    var out = {}, k;
    for (k in (marques || {})) if (marques[k]) out[k] = true;
    if (out[id]) delete out[id]; else out[id] = true;
    return out;
  }
  function lignesMarquees(lignes, marques) { return (lignes || []).filter(function (l) { return marques && marques[l.id]; }); }

  /* I85 : le coût de vie proposé par la récolte (ligne « Coût réel de ta vie… X € par mois », gardée par toi) -> montant mensuel ou null */
  function montantCoutVie(lignes) {
    var trouve = null;
    (lignes || []).forEach(function (l) {
      if (l.famille !== 'cout' || l.etat !== 'garde') return;
      var m = /^Coût réel de ta vie[^0-9]*([0-9][0-9 \u00a0]*(?:,[0-9]{1,2})?) € par mois/.exec(l.texte);
      if (m) trouve = { montant: nombre(m[1].replace(/\u00a0/g, ' ')), ligne: l };
    });
    return trouve;
  }

  /* I50 : une question prête pour un·e conseiller·ère financier·ère. Texte seulement : rien n'est envoyé,
     tu la copies et tu la poses toi-même. Les chiffres sont ceux que tu as saisis dans ce chiffrage ; le patrimoine n'y entre que si tu le demandes. */
  function questionConseillereFinances(r, besoinMensuel, avecPatrimoine) {
    function v(x, unite) { var n = nombre(x); return n === null ? 'non renseigné' : String(n).replace('.', ',') + unite; }
    var x = chiffrageReconversion({ coutFormation: r.coutFormation, moisSansRevenu: r.moisSansRevenu, revenuMensuelPerdu: r.revenuMensuelPerdu, patrimoine: r.patrimoine, coutVieMensuel: besoinMensuel });
    var l = ['Je chiffre une reconversion professionnelle et je voudrais ton regard de conseillère finances.',
      '- Coût de la formation ou des études : ' + v(r.coutFormation, ' €'),
      '- Mois sans revenu : ' + v(r.moisSansRevenu, ' mois'),
      '- Revenu mensuel perdu pendant ce temps : ' + v(r.revenuMensuelPerdu, ' €'),
      '- Ce qu\'il me faut par mois pour vivre : ' + v(besoinMensuel, ' €'),
      '- Coût total calculé : ' + (x.total === null ? 'non calculable' : String(Math.round(x.total)) + ' €')];
    if (avecPatrimoine) l.push('- Patrimoine mobilisable : ' + v(r.patrimoine, ' €') + ' (mois tenables : ' + (x.moisTenables === null ? 'non calculable' : String(Math.round(x.moisTenables * 10) / 10).replace('.', ',')) + ')');
    l.push('Questions : cette reconversion est-elle finançable sans entamer mon coussin de sécurité ? Quel ordre de priorités proposes-tu (coussin, dettes, projet) ? Qu\'est-ce que je n\'ai pas pensé à chiffrer (cotisations, assurance, retraite, impôts) ? Ne me propose pas de produit de placement : je veux seulement savoir si c\'est tenable.');
    return l.join('\n');
  }

  /* I64 : ce que tu ne veux pas = lignes écartées + refus gardés. Les mots qu'ils partagent avec une piste sont montrés, jamais appliqués. */
  var MOTS_VIDES = ' avec dans pour cette cette aussi plus tout tous tres entre sans sont etre avoir comme mais donc leur leurs elle elles nous vous ceux celui faire fait peut sous chez notre votre autre autres ';
  function eliminations(lignes) {
    return (lignes || []).filter(function (l) { return l.etat === 'ecarte' || (l.famille === 'refus' && l.etat === 'garde'); });
  }
  function motsDe(texte) {
    var vus = {}, out = [];
    rNorm(texte).split(' ').forEach(function (m) { if (m.length >= 6 && MOTS_VIDES.indexOf(' ' + m + ' ') < 0 && !vus[m]) { vus[m] = true; out.push(m); } });
    return out;
  }
  /* pistes : [{ id, nom, resume }] -> [{ id, nom, recoupes:[{ ligne, mots }] }], seulement les pistes qui ressemblent à au moins une ligne. */
  function recoupements(elims, pistes) {
    var mots = (elims || []).map(function (l) { return { ligne: l, mots: motsDe(l.texte) }; });
    var out = [];
    (pistes || []).forEach(function (p) {
      var motsP = motsDe((p.nom || '') + ' ' + (p.resume || '')), trouves = [];
      mots.forEach(function (e) {
        var communs = e.mots.filter(function (m) { return motsP.indexOf(m) >= 0; });
        if (communs.length) trouves.push({ ligne: e.ligne, mots: communs });
      });
      if (trouves.length) out.push({ id: p.id, nom: p.nom, recoupes: trouves });
    });
    return out;
  }

  /* ---------- État, export, import ---------- */
  function etatVide() {
    return {
      version: VERSION,
      cahier: {
        revenu: '', heures: '',
        revenuVise: null, plafondHeures: null, marge: null,
        lieu: '', statut: '', tempsLibre: '', doit: '',
        autonomie: '', projetVie: '',
        reglages: { heuresParJour: REGLAGES_DEFAUT.heuresParJour, semainesAn: REGLAGES_DEFAUT.semainesAn },
        reponses: { I16: '', I17: '', I33: '', I34: '' },
        titre: { texte: '', ditAVoixHaute: false, date: '' },
        troisColonnes: { aime: '', sais: '', paie: '' },
        missions: [1, 2, 3, 4, 5].map(function () { return { nom: '', valeur: '', heures: '' }; })
      },
      compteur: { scenario: 'bas', tri: 'vie', besoinMensuel: '',
        reconversion: { coutFormation: '', moisSansRevenu: '', revenuMensuelPerdu: '', patrimoine: '', retraite: '' } },
      recolte: { lignes: [], imports: [], marques: {} },
      pistes: {},
      pistesPerso: [],
      generateur: { qui: '', quoi: '', melange: '', portes: '', greffons: '' },
      bouquet: { parts: {} },
      tests: [],
      grille: { poids: poidsDefaut() },
      carnets: {},
      experience: { debut: '', heuresParSemaine: 20, semaines: [] },
      decision: {
        phase: 'programme', phases: {},
        vies: [{ nom: 'Le prolongement', texte: '', ans: ['', '', '', '', ''], prototype: '', parts: {} },
               { nom: 'Le virage', texte: '', ans: ['', '', '', '', ''], prototype: '', parts: {} },
               { nom: 'Le saut', texte: '', ans: ['', '', '', '', ''], prototype: '', parts: {} }],
        calendrier: [],
        points: [], reecritures: [], dateFin: ''
      }
    };
  }

  /* complète un état importé avec les valeurs par défaut (sans écraser ce qui est là) */
  function completer(modele, donnees) {
    if (Array.isArray(modele)) return Array.isArray(donnees) ? donnees : modele;
    if (modele && typeof modele === 'object') {
      var out = {};
      var cles = {}, k;
      for (k in modele) cles[k] = true;
      for (k in (donnees && typeof donnees === 'object' ? donnees : {})) cles[k] = true;
      for (k in cles) {
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
        if (k in modele) out[k] = completer(modele[k], donnees && typeof donnees === 'object' ? donnees[k] : undefined);
        else out[k] = donnees[k];
      }
      return out;
    }
    return donnees === undefined || donnees === null ? modele : donnees;
  }

  function exporter(etat) { return JSON.stringify(etat, null, 2); }

  /* Rend { ok:true, etat } ou { ok:false, erreur } ; ne modifie rien. */
  function importer(texte) {
    var o;
    if (typeof texte !== 'string' || !texte.trim()) return { ok: false, erreur: 'Le fichier est vide.' };
    try { o = JSON.parse(texte); } catch (e) { return { ok: false, erreur: 'Ce n\'est pas un fichier JSON lisible.' }; }
    if (!o || typeof o !== 'object' || Array.isArray(o)) return { ok: false, erreur: 'Le contenu n\'est pas un état de l\'app Métier.' };
    if (o.version === undefined) return { ok: false, erreur: 'Pas de numéro de version : ce fichier ne vient pas de l\'app Métier.' };
    if (nombre(o.version) === null || o.version > VERSION) return { ok: false, erreur: 'Ce fichier vient d\'une version plus récente (' + o.version + ') que cette page (' + VERSION + ').' };
    if (o.version < 1) return { ok: false, erreur: 'Numéro de version invalide.' };
    var etat = completer(etatVide(), o);
    etat.version = VERSION;
    etat.recolte.lignes = nettoyerLignes(etat.recolte.lignes);   // une ligne sans source n'existe pas, même dans un fichier modifié à la main
    return { ok: true, etat: etat };
  }

  return {
    VERSION: VERSION, CLE_STOCKAGE: CLE_STOCKAGE, REGLAGES_DEFAUT: REGLAGES_DEFAUT, CHAMPS_INVISIBLES: CHAMPS_INVISIBLES,
    CRITERES_GRILLE: CRITERES_GRILLE,
    nombre: nombre, arrondi: arrondi, fusionnerPiste: fusionnerPiste, heuresVisibles: heuresVisibles, heuresInvisibles: heuresInvisibles,
    revenuAnnuel: revenuAnnuel, chiffrer: chiffrer, heuresPourBesoin: heuresPourBesoin, auDelaMarge: auDelaMarge,
    courbeRevenus: courbeRevenus, auDessusPlafond: auDessusPlafond, classer: classer, baseHoraire: baseHoraire, profilEmploi: profilEmploi, mentionsPiste: mentionsPiste, prochaineVerification: prochaineVerification, classementPrincipal: classementPrincipal, entreeAuDela: entreeAuDela, poidsDefaut: poidsDefaut,
    noteGrille: noteGrille, grille: grille, bouquet: bouquet, tauxMissions: tauxMissions,
    chiffrageReconversion: chiffrageReconversion, ajouterMois: ajouterMois, ajouterJours: ajouterJours, joursEntre: joursEntre,
    joursRestants: joursRestants, prochainPoint: prochainPoint, prochaineReecriture: prochaineReecriture, finTest: finTest,
    verdictTest: verdictTest, derniereNouvelle: derniereNouvelle, bilanExperience: bilanExperience,
    calendrierAnnees: calendrierAnnees, marquer: marquer, lignesMarquees: lignesMarquees, montantCoutVie: montantCoutVie, questionConseillereFinances: questionConseillereFinances, croiser: croiser, estPetiteActivite: estPetiteActivite, sansPetitesActivites: sansPetitesActivites, phraseGenerateur: phraseGenerateur,
    FAMILLES_RECOLTE: FAMILLES_RECOLTE, lireRecolte: lireRecolte, fusionnerRecolte: fusionnerRecolte, decider: decider, ligneSaisie: ligneSaisie,
    ligneRecolte: ligneRecolte, comptesRecolte: comptesRecolte, eliminations: eliminations, recoupements: recoupements, idLigne: idLigne, familleRecolte: familleRecolte,
    combinaisonsGenerateur: combinaisonsGenerateur, etatVide: etatVide, completer: completer, exporter: exporter, importer: importer
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Metier;
