/* App « Métier » — fiches de pistes de départ et textes des questions.
   Règles : un tarif ou un chiffre sans source reste VIDE ; une valeur posée sans source est listée dans `supposes`
   (la page affiche alors « supposé »).
   Aucune donnée personnelle ici : ce que tu saisis reste sur ton appareil (stockage local + export JSON). */
var MetierDonnees = (function () {
  'use strict';

  var SRC_TJM = { texte: 'Fiche TJM « BIM manager, coordinateur BIM » (relevé du 05/11/2026)', url: 'https://travail-industrie.com/fiche-tjm/bim-manager-coordinateur-bim' };
  var SRC_GRILLE = { texte: 'Grille TJM 2026 (relevé du 05/11/2026)', url: 'https://www.regie-portage.fr/freelance/freelance-grille-tjm/' };
  var SRC_PROFILS = { texte: 'Profils individuels vus dans des résultats de recherche le 05/11/2026 (aucun lien exact conservé)', url: '' };
  var SRC_OFFRE = { texte: 'Offre publique « Expert incendie accessibilité » (date et conditions non vérifiées)', url: 'https://choisirleservicepublic.gouv.fr/offre-emploi/-reference-DEF_27-00065351/' };
  var SRC_IDEES = { texte: 'Idée de départ de l\'application, sans tarif relevé', url: '' };

  var GROUPES = {
    bilan: 'Six pistes de départ',
    rare: 'Vendre cher une heure rare',
    salaire: 'Un salaire, mais moins d\'heures',
    decouple: 'Gagner sans vendre ses heures',
    invente: 'Métiers à inventer'
  };

  function fiche(o) {
    var base = {
      id: '', idee: '', nom: '', groupe: 'rare', resume: '',
      tarifBas: null, tarifHaut: null, revenuBas: null, revenuHaut: null, nature: 'ca',
      joursSemaine: null, semainesAn: null, heuresVisSemaine: null, chargesPct: null,
      heuresInv: {}, distance: 'inconnue', urgences: 'inconnu', chantier: '',
      droitEntree: { mois: null, euros: null, note: '' },
      moisSansRevenu: null, arreter: '', plafonnable: '',
      delai: '', manque: '', responsabilite: '', voisine: '', notes: '',
      sources: [SRC_IDEES], supposes: [], statut: 'a_explorer', patron: 'aucune'
    };
    for (var k in o) base[k] = o[k];
    return base;
  }

  var PISTES = [
    /* ===== Six pistes de départ (tarifs relevés, ordres de grandeur faibles) ===== */
    fiche({ id: 'bilan-A', idee: 'Piste A', groupe: 'bilan', nom: 'Consultant·e réglementaire ERP, accessibilité, incendie (notices, dossiers)',
      resume: 'Résoudre un dossier bloqué par la synthèse réglementaire croisée (ERP, ABF, risques, SDIS, bureau de contrôle). Travail en grande partie écrit.',
      tarifBas: 500, tarifHaut: 600, joursSemaine: 2, distance: 'partielle', supposes: ['distance'],
      delai: 'Court, si les clients suivent', manque: 'Assurance, cadre, références à l\'acte',
      responsabilite: 'Assurance à prévoir ; l\'inscription à l\'Ordre des architectes décide de ce qui peut être signé.',
      notes: 'Notices probables à distance ; diagnostics sur place (supposé). Tarif : 2 profils relevés, dont un à 8-15 ans d\'expérience. Le chiffre d\'affaires hors taxes n\'est pas un revenu.',
      sources: [SRC_TJM, SRC_GRILLE, SRC_PROFILS] }),
    fiche({ id: 'bilan-B', idee: 'Piste B', groupe: 'bilan', nom: 'Coordinateur·rice ou manager BIM freelance',
      resume: 'Pilotage de la maquette numérique et de la coordination entre intervenants.',
      tarifBas: 420, tarifHaut: 750, joursSemaine: 2, distance: 'inconnue',
      delai: 'À évaluer', manque: 'Expérience de BIM management',
      notes: 'Distance non confirmée.', sources: [SRC_TJM, SRC_GRILLE] }),
    fiche({ id: 'bilan-C', idee: 'Piste C', groupe: 'bilan', nom: 'Renfort Revit ou synthèse pour agences',
      resume: 'Production sous Revit ou synthèse pour des agences, à la journée.',
      tarifBas: 300, tarifHaut: 450, joursSemaine: 2, distance: 'inconnue',
      delai: 'Immédiat', manque: 'Réseau, contrats', notes: 'Distance : variable selon l\'agence.',
      sources: [SRC_PROFILS] }),
    fiche({ id: 'bilan-D', idee: 'Piste D', groupe: 'bilan', nom: 'Dossiers de permis et de déclaration préalable au forfait',
      resume: 'Dossiers PC et DP à prix fixe ; un outil de synthèse des règles d\'urbanisme réduit les heures.',
      distance: 'partielle', supposes: ['distance'], delai: 'Selon l\'Ordre', manque: 'Ordre, assurance, tarif',
      responsabilite: 'Ce qui peut être signé dépend de l\'inscription à l\'Ordre des architectes.',
      notes: 'Tarif non recherché. Distance : probable, avec visite parfois. Voisine de I95.', voisine: 'I95' }),
    fiche({ id: 'bilan-E', idee: 'Piste E', groupe: 'bilan', nom: 'Poste à temps partiel en maîtrise d\'ouvrage ou dans le public (expert incendie et accessibilité, par exemple)',
      resume: 'Un employeur, moins d\'heures.',
      nature: 'brut', distance: 'partielle', supposes: ['distance'],
      delai: 'Selon recrutement', manque: 'Offres, négociation',
      notes: 'Salaire brut à saisir ; brut salarié et chiffre d\'affaires ne sont pas comparables. Renseigne le salaire et les jours par semaine pour obtenir l\'euro par heure. Voisine de I99, I100, I102.',
      voisine: 'I99 · I100 · I102', sources: [SRC_OFFRE] }),
    fiche({ id: 'bilan-F', idee: 'Piste F', groupe: 'bilan', nom: 'Produits : notices types, gabarits, listes de contrôle',
      resume: 'Faire baisser les heures ensuite, à partir de ce que la piste A produit.',
      distance: 'totale',
      delai: 'À démarrer en parallèle d\'une autre activité', manque: 'Preuve de demande',
      notes: 'Tarif non recherché. Voisine de I105.',
      voisine: 'I105' }),

    /* ===== Vendre cher une heure rare (I90 à I98) ===== */
    fiche({ id: 'I90', idee: 'I90', groupe: 'rare', nom: 'L\'expertise réglementaire à la demande',
      resume: 'Accessibilité, sécurité incendie, ERP (PMR, RE2020, ERP). Peu d\'heures, un savoir que les autres n\'ont pas.',
      voisine: 'Piste A', notes: 'Même piste que la piste A : voir son tarif.' }),
    fiche({ id: 'I91', idee: 'I91', groupe: 'rare', nom: 'Une visite-conseil avant achat',
      resume: 'Deux heures sur place pour éclairer un acheteur, sans chantier à suivre.', distance: 'surplace', supposes: ['distance'] }),
    fiche({ id: 'I92', idee: 'I92', groupe: 'rare', nom: 'Conseil à forfait aux copropriétés',
      resume: 'Missions de conseil à prix fixe pour des conseils syndicaux.' }),
    fiche({ id: 'I93', idee: 'I93', groupe: 'rare', nom: 'Expert de justice ou d\'assurance',
      resume: 'Missions ponctuelles et bien cadrées.', supposes: ['droitEntree'],
      droitEntree: { mois: null, euros: null, note: 'Conditions d\'accès supposées, à vérifier' }, notes: 'Conditions à vérifier (supposé).' }),
    fiche({ id: 'I94', idee: 'I94', groupe: 'rare', nom: 'Architecte-conseil en vacations (CAUE, collectivités)',
      resume: 'Des heures fixes, sans clientèle à chercher.', supposes: ['droitEntree'],
      droitEntree: { mois: null, euros: null, note: 'Conditions d\'accès supposées, à vérifier' }, notes: 'Supposé : conditions à vérifier.' }),
    fiche({ id: 'I95', idee: 'I95', groupe: 'rare', nom: 'Dossiers de permis et de déclaration préalable au forfait',
      resume: 'Très standardisés, avec un outil de synthèse des règles d\'urbanisme comme outil interne.', voisine: 'Piste D', notes: 'Même piste que la piste D.' }),
    fiche({ id: 'I96', idee: 'I96', groupe: 'rare', nom: 'Le renfort freelance à l\'expertise plutôt qu\'au volume',
      resume: 'Une pointe ERP sur un projet, pas un temps plein déguisé.', voisine: 'Piste C', notes: 'Proche de la piste C, mais vendu à l\'expertise.' }),
    fiche({ id: 'I97', idee: 'I97', groupe: 'rare', nom: 'Enseignement et jurys en école d\'architecture, ou formation RE2020 et PMR',
      resume: 'Préparé une fois, rejoué.', supposes: ['droitEntree'],
      droitEntree: { mois: null, euros: null, note: 'Conditions d\'accès supposées, à vérifier' }, notes: 'Supposé : conditions à vérifier.' }),
    fiche({ id: 'I98', idee: 'I98', groupe: 'rare', nom: 'Psychologie de l\'espace vendue en audit court',
      resume: 'Crèches, EHPAD, bureaux, cabinets médicaux.' }),

    /* ===== Un salaire, mais moins d'heures (I99 à I104) ===== */
    fiche({ id: 'I99', idee: 'I99', groupe: 'salaire', nom: 'Un poste à 4/5 ou à temps partiel négocié',
      resume: 'Argumentaire à préparer, éventuellement avec un juriste du travail.', nature: 'brut', voisine: 'Piste E' }),
    fiche({ id: 'I100', idee: 'I100', groupe: 'salaire', nom: 'Fonction publique territoriale ou d\'État',
      resume: 'Chargé·e d\'opération, horaires cadrés.', nature: 'brut', chantier: 'possible', supposes: ['chantier'],
      notes: 'Un·e chargé·e d\'opération peut suivre des chantiers (supposé).', voisine: 'Piste E' }),
    fiche({ id: 'I102', idee: 'I102', groupe: 'salaire', nom: 'Une maîtrise d\'ouvrage plutôt qu\'une agence',
      resume: 'Côté promoteur, bailleur, foncière ou collectivité : souvent d\'autres rythmes (supposé).', nature: 'brut',
      supposes: ['droitEntree'], droitEntree: { mois: null, euros: null, note: 'Conditions d\'accès supposées, à vérifier' }, voisine: 'Piste E' }),
    fiche({ id: 'I103', idee: 'I103', groupe: 'salaire', nom: 'Un socle à mi-temps qui sécurise, plus du conseil cher en complément',
      resume: 'Un employeur pour la base, des clients pour la pointe. À calculer dans l\'onglet « Bouquet ».' }),
    fiche({ id: 'I104', idee: 'I104', groupe: 'salaire', nom: 'La saison',
      resume: 'Travailler fort six mois, puis s\'arrêter : le temps libre arrive d\'un bloc.' }),

    /* ===== Gagner sans vendre ses heures (I105 à I112) ===== */
    fiche({ id: 'I105', idee: 'I105', groupe: 'decouple', nom: 'Des modèles à vendre',
      resume: 'Notices d\'accessibilité, trames de dossier, listes de contrôle, faits une fois.', distance: 'totale', supposes: ['distance'],
      voisine: 'Piste F', notes: 'Rentabilité inconnue. Mois sans revenu à renseigner.' }),
    fiche({ id: 'I106', idee: 'I106', groupe: 'decouple', nom: 'Motifs graphiques sous licence',
      resume: 'Droits d\'usage à trancher.',
      notes: 'Rentabilité inconnue. Mois sans revenu à renseigner.' }),
    fiche({ id: 'I107', idee: 'I107', groupe: 'decouple', nom: 'Un outil réglementaire ou de calcul vendu en service payant',
      resume: 'Maquettes existantes, retours attendus.',
      notes: 'Rentabilité inconnue. Mois sans revenu à renseigner.' }),
    fiche({ id: 'I108', idee: 'I108', groupe: 'decouple', nom: 'Une formation en ligne enregistrée',
      resume: 'Des ventes qui continuent sans toi.',
      notes: 'Rentabilité inconnue. Mois sans revenu à renseigner.' }),
    fiche({ id: 'I109', idee: 'I109', groupe: 'decouple', nom: 'Un parc locatif comme métier de fond',
      resume: 'LMNP, viager, immobilier ; le regard d\'un architecte comme avantage. Description seulement : aucun conseil de placement.',
      notes: 'Ceci décrit une direction. À creuser avec un professionnel.' }),
    fiche({ id: 'I110', idee: 'I110', groupe: 'decouple', nom: 'L\'investissement comme second salaire, à long terme',
      resume: 'Direction à creuser avec un professionnel ; cette fiche ne donne aucun conseil en placement.',
      notes: 'Aucun conseil en placement.' }),
    fiche({ id: 'I111', idee: 'I111', groupe: 'decouple', nom: 'Rédiger un livre ou un guide de référence sur sa spécialité',
      resume: 'Un ouvrage qui se vend ensuite.',
      notes: 'Rentabilité inconnue. Mois sans revenu à renseigner.' }),
    fiche({ id: 'I112', idee: 'I112', groupe: 'decouple', nom: 'Vendre une méthode d\'organisation à des architectes indépendants',
      resume: 'Une méthode de travail et d\'organisation, proposée comme service.' }),

    /* ===== Métiers à inventer (I29, I36) ===== */
    fiche({ id: 'I29', idee: 'I29', groupe: 'invente', nom: 'L\'architecte de l\'habiter',
      resume: 'Le croisement de la psychologie et de l\'architecture.', notes: 'Fiche à compléter.' }),
    fiche({ id: 'I36', idee: 'I36', groupe: 'invente', nom: 'Aider d\'autres personnes à organiser leur vie',
      resume: 'Aider d\'autres personnes à construire leur organisation de vie.', notes: 'Fiche à compléter.' })
  ];

  /* Textes des questions du cahier des charges */
  var QUESTIONS = {
    I16: { titre: 'La question du dimanche matin', texte: 'À quoi travaillerais-tu si personne ne le voyait, jamais ?' },
    I17: { titre: 'La question de l\'argent réglé', texte: 'Si tes revenus étaient assurés pendant dix ans, que garderais-tu ?' },
    I33: { titre: 'Un problème aimé', texte: 'Quelle souffrance du monde t\'énerve assez pour y passer trente ans ?' },
    I34: { titre: 'La fiche de poste de ta vie', texte: 'Rédige-la comme une annonce, puis relis-la : te fait-elle envie ?' }
  };

  /* I54 : les phases de l'architecte */
  var PHASES = [
    { id: 'programme', nom: 'Programme', aide: 'Ce que le métier doit être : critères, besoins, contraintes.' },
    { id: 'esquisse', nom: 'Esquisse', aide: 'Premières pistes retenues, comparées au compteur.' },
    { id: 'avant-projet', nom: 'Avant-projet', aide: 'Tests de deux semaines, avec seuils fixés avant.' },
    { id: 'projet', nom: 'Projet', aide: 'Choix et plan : phases, calendrier, financement.' },
    { id: 'chantier', nom: 'Chantier', aide: 'Mise en route, expérience de trois mois.' },
    { id: 'reception', nom: 'Réception', aide: 'Bilan de l\'expérience, puis points tous les six mois.' }
  ];

  var ETAPES_PATRON = [
    { id: 'aucune', nom: 'Pas commencé' },
    { id: 'toile', nom: 'Toile d\'essai' },
    { id: 'retouches', nom: 'Retouches' },
    { id: 'seconde', nom: 'Seconde toile' },
    { id: 'coupe', nom: 'Coupe dans le tissu' }
  ];

  var DISTANCES = [
    { id: 'totale', nom: 'Totalement à distance' }, { id: 'principale', nom: 'Principalement à distance' },
    { id: 'partielle', nom: 'En partie à distance' }, { id: 'surplace', nom: 'Sur place' }, { id: 'inconnue', nom: 'Pas encore établi' }
  ];
  var URGENCES = [
    { id: 'inconnu', nom: 'Pas encore établi' }, { id: 'aucune', nom: 'Aucune' }, { id: 'rares', nom: 'Rares' }, { id: 'frequentes', nom: 'Fréquentes' }
  ];

  function nouvelle(id, nom) { return fiche({ id: id, idee: 'Ajoutée', groupe: 'invente', nom: nom, sources: [], resume: '' }); }

  return { nouvelle: nouvelle, PISTES: PISTES, GROUPES: GROUPES, QUESTIONS: QUESTIONS, PHASES: PHASES, ETAPES_PATRON: ETAPES_PATRON,
    DISTANCES: DISTANCES, URGENCES: URGENCES };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = MetierDonnees;
