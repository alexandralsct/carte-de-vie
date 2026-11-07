/* App « Métier » — métiers porteurs (enquête de novembre 2026 : une cinquantaine de métiers en croissance).
   Les fiches viennent de porteurs_donnees.js (relevé de pages OUVERTES ; chaque chiffre y garde sa source et sa date).
   Ici : le code qui les verse au classement et les décrit. Règles : un fait introuvable reste null ; une prévision n'est pas une certitude ;
   une prévision publiée (institution) est séparée d'une opinion ou d'une source commerciale. Aucun conseil de placement. */
var MetierPorteurs = (function () {
  'use strict';

  var NATURES_CROISSANCE = { prevision_publiee: 'prévision publiée', projection_publiee: 'projection publiée (prolongement de tendances : la Dares écrit que ce ne sont pas des prévisions)', constat_publie: 'constat publié (un fait observé, pas une prévision)', opinion_ou_commerciale: 'opinion ou source commerciale' };
  var PORTEES = { secteur: 'chiffre du SECTEUR ou de l\'ensemble du marché, pas du métier', metier: 'chiffre propre au métier' };
  var RISQUES_IA = { faible: 'risque faible', moyen: 'risque moyen', eleve: 'risque élevé' };
  var PROFILS = { salarie_debutant: 'salarié·e débutant·e', salarie_confirme: 'salarié·e confirmé·e', independant_debutant: 'indépendant·e débutant·e', independant_confirme: 'indépendant·e confirmé·e' };
  var UNITES = { euros_brut_annuel: '€ brut par an', euros_brut_mensuel: '€ brut par mois', euros_jour_HT: '€ par jour hors taxes', euros_heure_HT: '€ par heure hors taxes' };
  var JOUR = '2026-11-05';

  function nb(v) { return typeof v === 'number' && isFinite(v) ? v : null; }
  function plein(v) { return v !== null && v !== undefined && !(typeof v === 'string' && !v.trim()) && !(Array.isArray(v) && !v.length); }

  /* Un fait est « complet » quand sa valeur est là ET (si c'est un chiffre ou une prévision) sa source l'est aussi. Liste des manques, pour dire la vérité. */
  function manques(f) {
    var m = [];
    if (!plein(f.quoi)) m.push('description');
    if (!plein(f.journee)) m.push('journée type');
    if (!f.croissance || !plein(f.croissance.chiffre) || !f.croissance.source || !plein(f.croissance.horizon)) m.push('croissance chiffrée et sourcée');
    if (!f.ia || !plein(f.ia.risque)) m.push('risque IA');
    var rev = (f.revenus || []).filter(function (r) { return (nb(r.bas) !== null || nb(r.haut) !== null) && r.source; });
    if (!rev.some(function (r) { return /^salarie/.test(r.profil); })) m.push('revenu salarié');
    if (!rev.some(function (r) { return /^independant/.test(r.profil); })) m.push('revenu indépendant');
    if (!f.heures || f.heures.temps_partiel === 'inconnu' || !plein(f.heures.temps_partiel)) m.push('heures et temps partiel');
    if (!f.distance || (f.distance.salarie === 'inconnue' && f.distance.independant === 'inconnue') || !f.distance.source) m.push('part à distance sourcée');
    var a = f.acces || {};
    if (!plein(a.diplome)) m.push('diplôme ou certification');
    if (nb(a.duree_mois) === null) m.push('durée d\'accès');
    if (nb(a.cout_euros) === null) m.push('coût d\'accès');
    if (!plein(a.financements)) m.push('financements');
    if (!plein(a.vae_ou_dispense)) m.push('VAE ou dispense');
    if (!plein(a.sources)) m.push('source des modalités d\'accès');
    if (nb(f.delai_premier_revenu_mois) === null) m.push('délai avant le premier revenu');
    if (!plein(f.premiere_action_30j)) m.push('première action');
    return m;
  }
  function complete(f) { return manques(f).length === 0; }

  /* installation : la fiche porteuse s'attache à une fiche existante (même métier) ou devient une nouvelle piste */
  var installe = false;
  function installer(D, donnees, existants) {
    if (installe) return;
    installe = true;
    (donnees || []).forEach(function (f) {
      var cible = existants && existants[f.id] ? D.PISTES.filter(function (p) { return p.id === existants[f.id]; })[0] : null;
      if (cible) { cible.porteur = f; return; }
      var p = D.nouvelle(f.id, f.nom);
      p.idee = 'Porteur'; p.groupe = 'porteur'; p.resume = f.quoi || ''; p.rome = f.rome || '';
      p.sources = sourcesDe(f);
      /* plusieurs sources pour un même profil : on garde la plus basse (prudence) */
      function annuel(r) { return r.unite === 'euros_brut_mensuel' ? r.bas * 12 : r.bas; }
      var sal = (f.revenus || []).filter(function (r) { return r.profil === 'salarie_debutant' && nb(r.bas) !== null && /^euros_brut/.test(r.unite); })
        .sort(function (a, b) { return annuel(a) - annuel(b); })[0];
      var ind = (f.revenus || []).filter(function (r) { return r.profil === 'independant_debutant' && nb(r.bas) !== null; }).sort(function (a, b) { return a.bas - b.bas; })[0];
      p.supposes = [];
      if (sal) {
        p.nature = 'brut'; p.revenuBas = sal.unite === 'euros_brut_mensuel' ? Math.round(sal.bas * 12) : sal.bas;
        var h = nb(sal.haut); if (h !== null) p.revenuHaut = sal.unite === 'euros_brut_mensuel' ? Math.round(h * 12) : h;
        p.joursSemaine = 5; p.supposes.push('joursSemaine');
      } else if (ind && ind.unite === 'euros_jour_HT') { p.nature = 'ca'; p.tarifBas = ind.bas; if (nb(ind.haut) !== null) p.tarifHaut = ind.haut; }
      else if (ind && ind.unite === 'euros_heure_HT') { p.nature = 'ca'; p.euroHeureBas = ind.bas; p.euroHeureHaut = nb(ind.haut); p.euroHeureNature = 'facturé HT'; }
      var d = f.distance || {};
      var dist = sal ? d.salarie : (d.independant || d.salarie);
      p.distance = dist && dist !== 'inconnue' ? dist : 'inconnue';
      if (p.distance !== 'inconnue' && !d.source) p.supposes.push('distance');
      var a = f.acces || {};
      p.droitEntree = { mois: nb(a.duree_mois), euros: nb(a.cout_euros), note: [a.diplome, a.reglemente_ou_obligatoire].filter(plein).join(' — ') };
      if (nb(f.delai_premier_revenu_mois) !== null) { p.moisSansRevenu = f.delai_premier_revenu_mois; p.supposes.push('moisSansRevenu'); }
      p.manque = (f.manque || []).join(' ; ');
      p.faitsInconnus = f.faits_introuvables || [];
      p.porteur = f;
      D.PISTES.push(p);
    });
  }
  function sourcesDe(f) {
    var vus = {}, out = [];
    function ajoute(s, nature) {
      if (!s || !s.url || vus[s.url]) return; vus[s.url] = true;
      out.push({ texte: s.titre || s.url, url: s.url, date: JOUR, nature: nature || 'publique', ouverte: !!s.ouverte, publie: s.date_publication || '' });
    }
    if (f.croissance) ajoute(f.croissance.source, f.croissance.nature === 'prevision_publiee' ? 'officielle' : 'commerciale');
    if (f.ia) ajoute(f.ia.source, f.ia.nature === 'prevision_publiee' ? 'officielle' : 'commerciale');
    (f.revenus || []).forEach(function (r) { ajoute(r.source, 'publique'); });
    if (f.heures) ajoute(f.heures.source); if (f.distance) ajoute(f.distance.source);
    ((f.acces || {}).sources || []).forEach(function (s) { ajoute(s, 'publique'); });
    return out;
  }

  if (typeof MetierDonnees !== 'undefined' && typeof MetierPorteursDonnees !== 'undefined') {
    MetierDonnees.GROUPES.porteur = 'Métiers porteurs';
    installer(MetierDonnees, MetierPorteursDonnees.fiches, MetierPorteursDonnees.existants);
  }

  return { PORTEES: PORTEES, NATURES_CROISSANCE: NATURES_CROISSANCE, RISQUES_IA: RISQUES_IA, PROFILS: PROFILS, UNITES: UNITES, manques: manques, complete: complete, installer: installer, sourcesDe: sourcesDe };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = MetierPorteurs;
