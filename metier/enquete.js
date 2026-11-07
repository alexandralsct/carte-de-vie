/* App « Métier » — l'enquête de novembre 2026 (répertoire des métiers, galerie de parcours, voie psychologie).
   Les fiches s'ajoutent à celles de donnees.js et se classent dans le compteur comme les autres.
   Règles : un fait inconnu reste vide ; une valeur posée sans source est listée dans `supposes` (la page affiche « supposé ») ;
   chaque source porte une date de consultation, une nature (officielle, publique, commerciale, annonce, profil) et dit si la page a été ouverte.
   « Page non ouverte » = le chiffre vient du résumé d'un résultat de moteur de recherche : à vérifier avant de s'y fier.
   Aucune donnée personnelle ici. Aucune prise de contact avec les personnes de la galerie. */
var MetierEnquete = (function () {
  'use strict';

  var JOUR = '2026-11-05';
  var NATURES = {
    officielle: 'source officielle', publique: 'organisme public d\'information', commerciale: 'source commerciale (non officielle)',
    annonce: 'annonce (non ouverte)', profil: 'profil ou texte publié par la personne ou son entreprise'
  };
  function src(texte, url, nature, ouverte, publie) { return { texte: texte, url: url, date: JOUR, nature: nature, ouverte: !!ouverte, publie: publie || '' }; }

  /* ---------- sources partagées ---------- */
  var ROME = src('ROME 4.0, arborescence principale d\'octobre 2026 (France Travail, données ouvertes) : 1 923 fiches ; ni salaire ni part à distance',
    'https://www.data.gouv.fr/fr/datasets/repertoire-operationnel-des-metiers-et-des-emplois-rome/', 'officielle', true);
  function cidj(slug, texte) { return src(texte, 'https://www.cidj.com/metiers/' + slug, 'publique', false); }
  var ONISEP_OUVERTES = ['conseiller-conseillere-energie', 'economiste-de-la-construction', 'urbaniste', 'ergonome', 'gestionnaire-de-patrimoine'];   // pages lues le 05/11 dans le navigateur intégré
  function onisep(slug, texte) { var o = ONISEP_OUVERTES.indexOf(slug) >= 0; return src(o ? texte.replace(' (page non ouverte)', ' (page ouverte le 05/11)') : texte, 'https://www.onisep.fr/ressources/univers-metier/metiers/' + slug, 'officielle', o); }
  function ti(chemin, texte) { return src(texte + ' (simulateur non officiel)', 'https://travail-industrie.com/' + chemin, 'commerciale', false); }
  function offre(id, texte) { return src(texte, 'https://candidat.francetravail.fr/offres/recherche/detail/' + id, 'annonce', false); }

  var GROUPES = {
    enquete: 'Métiers repérés dans le ROME',
    psycho: 'Voie psychologie'
  };


  /* fiche d'enquête : D.nouvelle donne la base commune du lot 1 */
  function fiche(o) {
    var D = MetierDonnees;
    var f = D.nouvelle(o.id, o.nom);
    f.idee = o.idee || 'I21'; f.groupe = o.groupe || 'enquete'; f.resume = o.resume || '';
    f.sources = o.sources || [ROME];
    f.supposes = o.supposes || [];
    f.nature = o.nature || 'brut';
    ['revenuBas', 'revenuHaut', 'tarifBas', 'tarifHaut', 'distance', 'moisSansRevenu', 'chantier', 'notes', 'responsabilite', 'delai', 'manque', 'joursSemaine', 'voisine'].forEach(function (k) {
      if (o[k] !== undefined) f[k] = o[k];
    });
    if (o.droitEntree) f.droitEntree = o.droitEntree;
    f.rome = o.rome || '';
    f.valorise = o.valorise || [];
    f.faitsInconnus = o.faitsInconnus || [];
    return f;
  }
  /* un poste salarié est supposé à temps plein : 5 jours par semaine (non relevé dans les sources) */
  function salarie(o) {
    o.joursSemaine = 5;
    o.supposes = (o.supposes || []).concat(['joursSemaine']);
    return fiche(o);
  }
  var NOTE_ANNEE = 'Brut annuel = brut mensuel relevé × 12 (sans 13e mois). Débutant, temps plein supposé. Le brut salarié n\'est pas comparable au chiffre d\'affaires d\'un indépendant.';

  /* ---------- I21 : 21 métiers du ROME proches de l'architecture et du bâtiment ---------- */
  var METIERS = [
    salarie({ id: 'enq-F1103', rome: 'F1103', nom: 'Diagnostiqueur / diagnostiqueuse immobilier', valorise: [],
      resume: 'Diagnostics réglementaires d\'un logement (rapports écrits) ; la moitié du travail est un rapport rédigé.',
      revenuBas: 24000, distance: 'surplace', supposes: ['distance'],
      droitEntree: { mois: null, euros: null, note: 'Certifications obligatoires à renouveler tous les 7 ans ; formation + examens, ou 3 ans d\'expérience dans le bâtiment (fiche France Compétences citée par un résultat de recherche). Coût non relevé.' },
      notes: 'CIDJ : 2 000 € brut/mois en début de carrière (+ intéressement, véhicule selon l\'employeur). Indépendants : chiffre d\'affaires moyen annoncé de 60 à 90 k€ par un site commercial (CA, pas un revenu). Visites sur place : supposé. ' + NOTE_ANNEE,
      faitsInconnus: ['heures par semaine', 'part à distance sourcée', 'coût de la certification'],
      sources: [ROME, cidj('diagnostiqueur-diagnostiqueuse-immobilier', 'CIDJ, fiche « Diagnostiqueur immobilier » (page non ouverte)'),
        src('creerentreprise.fr : chiffre d\'affaires des indépendants (page non ouverte)', 'https://www.creerentreprise.fr/sinstaller-diagnostiqueur-immobilier/amp/', 'commerciale', false)] }),
    salarie({ id: 'enq-F1114', rome: 'F1114', nom: 'Conseiller / conseillère en rénovation énergétique', valorise: [],
      resume: 'Accompagner des particuliers ou des copropriétés dans un projet de rénovation (aides, travaux, dossiers).',
      revenuBas: 22416, revenuHaut: 30828,
      notes: 'Onisep : 1 868 € brut/mois en début de carrière, niveau bac+2 minimum ; CIDJ : 1 900 € ; une offre du CAUE de l\'Aude de 2023 : 2 569 € brut/mois (haut de la fourchette). Onisep dit seulement « à son bureau » : aucune donnée de télétravail. ' + NOTE_ANNEE,
      faitsInconnus: ['heures par semaine', 'part à distance', 'droit d\'entrée'],
      sources: [ROME, onisep('conseiller-conseillere-energie', 'Onisep, fiche « Conseiller énergie » (page non ouverte)'), cidj('conseiller-conseillere-energie', 'CIDJ, fiche « Conseiller énergie » (page non ouverte)')] }),
    salarie({ id: 'enq-F1120', rome: 'F1120', nom: 'Économiste de la construction', valorise: [],
      resume: 'Chiffrer un projet (métrés, estimations, suivi des coûts) pour la maîtrise d\'œuvre ou la maîtrise d\'ouvrage.',
      revenuBas: 27600, revenuHaut: 36000,
      droitEntree: { mois: null, euros: null, note: 'Onisep : niveau minimum bac+5 ; CIDJ : bac+2 au minimum.' },
      notes: 'Onisep : 2 500 € brut/mois (bac+5) ; CIDJ : du Smic à 2 500 € ; simulateur non officiel : 2 300 à 3 000 €. ' + NOTE_ANNEE,
      faitsInconnus: ['heures par semaine', 'part à distance'],
      sources: [ROME, onisep('economiste-de-la-construction', 'Onisep, fiche « Économiste de la construction » (page non ouverte)'), cidj('economiste-de-la-construction', 'CIDJ, fiche « Économiste de la construction » (page non ouverte)'),
        ti('fiche-salaire/economiste-de-la-construction', 'travail-industrie.com')] }),
    salarie({ id: 'enq-F1130', rome: 'F1130', nom: 'Contrôleur / contrôleuse technique de la construction', valorise: [],
      resume: 'Bureau de contrôle : vérifier la conformité réglementaire d\'un projet (solidité, sécurité, accessibilité).',
      revenuBas: 36000, revenuHaut: 45000, distance: 'surplace', chantier: 'possible', supposes: ['distance', 'chantier'],
      droitEntree: { mois: null, euros: null, note: 'Les offres de débutants demandent un bac+5 bâtiment ou génie civil. Agrément du contrôleur technique : non relevé.' },
      notes: 'Une annonce d\'Avignon : « à partir de 36 k€ brut annuel », débutant ; simulateur non officiel : 36 à 45 k€. Les offres relevées parlent de déplacements quotidiens (terrain), ce qui est le contraire d\'un travail principalement à distance : supposé, annonces non ouvertes. Métier de bureau de contrôle, voisin de la piste A.',
      faitsInconnus: ['heures par semaine', 'part à distance sourcée'], voisine: 'Piste A',
      sources: [ROME, offre('4849075', 'Offre France Travail « Ingénieur.e Contrôle Technique Construction débutant », Avignon (annonce non ouverte)'),
        ti('simulateur-salaire/btp-genie-civil/ingenieur-controle-technique/junior', 'travail-industrie.com, ingénieur contrôle technique junior')] }),
    salarie({ id: 'enq-F1104', rome: 'F1104', nom: 'Dessinateur-projeteur / dessinatrice-projeteuse de la construction (BIM, Revit)', valorise: [],
      resume: 'Produire et coordonner les plans et la maquette numérique d\'un projet, en bureau d\'études ou en agence.',
      revenuBas: 22800, revenuHaut: 34000, distance: 'partielle', supposes: ['distance'],
      notes: 'Simulateur non officiel : 28 à 34 k€ brut/an pour un débutant BIM ; fiche-paie.fr (convention Syntec) : 1 900 à 2 200 € brut/mois. Un site cite le télétravail comme « développé pour la modélisation », sans chiffre : « en partie à distance » est supposé. Voisine de la piste C (renfort Revit en freelance). ' + NOTE_ANNEE,
      faitsInconnus: ['heures par semaine', 'part à distance chiffrée', 'droit d\'entrée'], voisine: 'Piste C',
      sources: [ROME, ti('simulateur-salaire/btp-genie-civil/dessinateur-projeteur-bim/junior', 'travail-industrie.com, dessinateur-projeteur BIM junior'),
        src('fiche-paie.fr, projeteur BIM (page non ouverte)', 'https://fiche-paie.fr/metier/projeteur-bim', 'commerciale', false)] }),
    salarie({ id: 'enq-K1807', rome: 'K1807', nom: 'Urbaniste', valorise: [],
      resume: 'Planification et règles d\'aménagement pour une collectivité, un bureau d\'études ou un aménageur.',
      revenuBas: 30000, revenuHaut: 36000,
      droitEntree: { mois: null, euros: null, note: 'Onisep : bac+5 ; CIDJ : écoles d\'architecture avec spécialisation en urbanisme, masters, écoles d\'ingénieurs.' },
      notes: 'CIDJ : 2 500 € brut/mois ; Onisep : 3 000 € (fiche de mai 2025 reprise par un site). Fonction publique territoriale : environ 2 000 € brut/mois hors primes (échelon 1 d\'ingénieur territorial). ' + NOTE_ANNEE,
      faitsInconnus: ['heures par semaine', 'part à distance'],
      sources: [ROME, onisep('urbaniste', 'Onisep, fiche « Urbaniste » (page non ouverte)'), cidj('urbaniste', 'CIDJ, fiche « Urbaniste » (page non ouverte)')] }),
    salarie({ id: 'enq-M1412', rome: 'M1412', nom: 'Ergonome', valorise: [], idee: 'I21',
      resume: 'Adapter un lieu de travail ou un équipement à ses usagers : un métier voisin de la psychologie de l\'espace.',
      revenuBas: 28000, revenuHaut: 35000,
      droitEntree: { mois: null, euros: null, note: 'Onisep : niveau d\'accès bac+5 (master d\'ergonomie).' },
      notes: 'Onisep : 2 770 € brut/mois ; simulateur non officiel : 28 à 35 k€ brut/an ; une offre de consultant ergonome à Rambouillet : 33 à 35 k€, débutant accepté. Aucun tarif d\'indépendant trouvé. ' + NOTE_ANNEE,
      faitsInconnus: ['heures par semaine', 'part à distance', 'tarif d\'indépendant'],
      sources: [ROME, onisep('ergonome', 'Onisep, fiche « Ergonome » (page non ouverte)'), offre('4868377', 'Offre France Travail « Consultant ergonome », Rambouillet (annonce non ouverte)'),
        ti('fiche-salaire/ergonome-industriel', 'travail-industrie.com')] }),
    salarie({ id: 'enq-K2111', rome: 'K2111', nom: 'Formateur / formatrice', valorise: [],
      resume: 'Former des professionnels (par exemple à l\'accessibilité ou à la RE2020) ; voisin de l\'idée I97.',
      revenuBas: 25000, revenuHaut: 30000, idee: 'I21',
      notes: 'Simulateur non officiel : 25 à 30 k€ brut/an pour un formateur débutant (0-2 ans) ; un autre site : 23 k€. Aucun tarif journalier de formateur indépendant trouvé. ' + NOTE_ANNEE,
      faitsInconnus: ['heures par semaine', 'part à distance', 'tarif journalier d\'indépendant', 'droit d\'entrée'], voisine: 'I97',
      sources: [ROME, ti('simulateur-salaire/education-formation/formateur-professionnel/junior', 'travail-industrie.com, formateur professionnel junior')] }),
    salarie({ id: 'enq-M1413', rome: 'M1413', nom: 'Chargé / chargée de mission RSE', valorise: [],
      resume: 'Conformité et pilotage environnemental d\'une entreprise (rapports, dossiers réglementaires).',
      revenuBas: 28000, revenuHaut: 34000,
      notes: 'Simulateur non officiel : 28 à 34 k€ brut/an en début de carrière ; d\'autres sites vont de 2 400 à 3 300 € brut/mois. Les offres d\'alternance affichent des montants plus bas (pourcentage du Smic). ' + NOTE_ANNEE,
      faitsInconnus: ['heures par semaine', 'part à distance', 'droit d\'entrée'],
      sources: [ROME, ti('simulateur-salaire/energie-environnement/charge-mission-rse/confirme', 'travail-industrie.com, chargé de mission RSE (tranche débutant lue dans le résumé)')] }),
    salarie({ id: 'enq-C1501', rome: 'C1501', nom: 'Gestionnaire de copropriété', valorise: [],
      resume: 'Gérer des copropriétés pour un syndic (assemblées, travaux, budgets) .',
      revenuBas: 24000, revenuHaut: 32000,
      droitEntree: { mois: null, euros: null, note: 'CIDJ (syndic de copropriété) : la carte professionnelle est indispensable pour s\'installer à son compte.' },
      notes: 'CIDJ (fiche « Syndic de copropriété ») : de 2 000 € brut/mois en salariat à environ 6 000 € en libéral ; simulateur non officiel : 26 à 32 k€ brut/an pour un débutant. ' + NOTE_ANNEE,
      faitsInconnus: ['heures par semaine', 'part à distance'],
      sources: [ROME, cidj('syndic-de-copropriete', 'CIDJ, fiche « Syndic de copropriété » (page non ouverte)'), ti('simulateur-salaire/immobilier/gestionnaire-copropriete/junior', 'travail-industrie.com, gestionnaire de copropriété junior')] }),
    salarie({ id: 'enq-F1135', rome: 'F1135', nom: 'Chargé / chargée d\'affaires BTP', valorise: [],
      resume: 'Piloter des affaires de travaux côté entreprise ou bureau d\'études.',
      revenuBas: 34000, revenuHaut: 42000, chantier: 'possible', supposes: ['chantier'],
      notes: 'Simulateur non officiel : 34 à 42 k€ brut/an pour un débutant (0-2 ans). Suivi de chantier possible : supposé (il s\'oppose à un critère de travail à distance). ' + NOTE_ANNEE,
      faitsInconnus: ['heures par semaine', 'part à distance', 'droit d\'entrée'],
      sources: [ROME, ti('simulateur-salaire/btp-genie-civil/charge-daffaires-btp/junior', 'travail-industrie.com, chargé d\'affaires BTP junior')] }),
    salarie({ id: 'enq-H1207', rome: 'H1207', nom: 'Rédacteur / rédactrice technique', valorise: [],
      resume: 'Écrire des notices, des procédures, de la documentation technique : du travail écrit, ce qui se fait souvent chez soi (supposé).',
      revenuBas: 27600, revenuHaut: 35000,
      notes: 'fiche-paie.fr : environ 2 300 € brut/mois en 2026 pour un débutant ; une offre d\'intérim junior à Neuville-sur-Oise : 30 à 35 k€ brut. Aucune donnée de télétravail ni de tarif freelance trouvée. ' + NOTE_ANNEE,
      faitsInconnus: ['heures par semaine', 'part à distance', 'tarif freelance', 'droit d\'entrée'],
      sources: [ROME, src('fiche-paie.fr, rédacteur technique (page non ouverte)', 'https://fiche-paie.fr/metier/redacteur-technique', 'commerciale', false),
        offre('6091222', 'Offre France Travail « Rédacteur technique junior », Neuville-sur-Oise (annonce non ouverte)')] }),
    salarie({ id: 'enq-F1102', rome: 'F1102', nom: 'Architecte d\'intérieur', valorise: [],
      resume: 'Aménager des intérieurs ; en libéral, honoraires au pourcentage des travaux ou au forfait.',
      revenuBas: 27600,
      droitEntree: { mois: null, euros: null, note: 'Le titre « architecte » reste réservé aux inscrits à l\'Ordre ; non relevé pour « architecte d\'intérieur ».' },
      notes: 'Onisep : environ 2 300 € brut/mois au départ ; en libéral, honoraires non fixés par la loi et premières années souvent précaires (résumé de recherche). ' + NOTE_ANNEE,
      faitsInconnus: ['heures par semaine', 'part à distance', 'honoraires réels'],
      sources: [ROME, onisep('architecte-d-interieur/pdf', 'Onisep, fiche « Architecte d\'intérieur » (page non ouverte)')] }),
    salarie({ id: 'enq-F1113', rome: 'F1113', nom: 'Responsable énergie (bâtiment)', valorise: [],
      resume: 'Suivre les consommations et les travaux d\'efficacité énergétique d\'un parc de bâtiments.',
      revenuBas: 32000, revenuHaut: 38000,
      notes: 'Simulateur non officiel : 32 à 38 k€ brut/an pour un junior ; une offre d\'« energy manager » à Chalon-sur-Saône : 38 k€ brut, 2 ans d\'expérience demandés. ' + NOTE_ANNEE,
      faitsInconnus: ['heures par semaine', 'part à distance', 'droit d\'entrée'],
      sources: [ROME, ti('simulateur-salaire/energie-environnement/responsable-energie-batiment/junior', 'travail-industrie.com, responsable énergie bâtiment junior'),
        offre('5187620', 'Offre France Travail « Energy Manager », Chalon-sur-Saône (annonce non ouverte)')] }),
    salarie({ id: 'enq-K1903', rome: 'K1903', nom: 'Juriste (droit de la construction et de l\'immobilier)', valorise: [],
      resume: 'Sécuriser les contrats, litiges et autorisations d\'un maître d\'ouvrage ou d\'une entreprise du bâtiment.',
      revenuBas: 35000, revenuHaut: 45000,
      droitEntree: { mois: null, euros: null, note: 'Formation juridique (non relevée). Les offres citées demandent 3 à 5 ans d\'expérience.' },
      notes: 'Simulateur non officiel (juriste immobilier junior) : 35 à 45 k€ brut/an ; offres : Bordeaux 40 à 50 k€, Saint-Laurent-du-Var 40 à 45 k€ (3 ans d\'expérience demandés). Un diplôme d\'architecte ne vaut pas une formation juridique : le droit d\'entrée est probablement long, non établi. ' + NOTE_ANNEE,
      faitsInconnus: ['heures par semaine', 'part à distance', 'durée et coût de la formation juridique'],
      sources: [ROME, ti('simulateur-salaire/rh-juridique/juriste-immobilier/junior', 'travail-industrie.com, juriste immobilier junior'),
        offre('190XZQG', 'Offre France Travail « Juriste en droit de la construction », Bordeaux (annonce non ouverte)')] }),
    salarie({ id: 'enq-C1506', rome: 'C1506', nom: 'Responsable de projet immobilier, assistant à maîtrise d\'ouvrage (AMO)', valorise: [],
      resume: 'Piloter un programme pour le compte d\'un maître d\'ouvrage : proche d\'un poste en maîtrise d\'ouvrage.',
      revenuBas: 36000, revenuHaut: 42000, voisine: 'Piste E',
      notes: 'Le rapprochement entre la fiche ROME C1506 et le métier d\'AMO est un rapprochement de l\'auteur de la fiche, pas du ROME. Simulateur non officiel (AMO bâtiment débutant) : 36 à 42 k€ brut/an. Une annonce d\'AMO à Paris précisait « télétravail non autorisé » : la distance dépend de l\'employeur (annonce non ouverte). ' + NOTE_ANNEE,
      faitsInconnus: ['heures par semaine', 'part à distance'],
      sources: [ROME, ti('simulateur-salaire/btp-genie-civil/assistant-maitrise-douvrage/junior', 'travail-industrie.com, assistant maîtrise d\'ouvrage junior')] }),
    /* quatre métiers repérés dans le ROME, mais sans aucun chiffre trouvé : tout reste vide */
    fiche({ id: 'enq-H1313', rome: 'H1313', nom: 'Ingénieur / ingénieure sécurité incendie', valorise: [],
      resume: 'Concevoir et justifier la sécurité incendie d\'un bâtiment (ERP, SDIS).',
      notes: 'Aucun salaire de débutant trouvé : une offre du CSTB demande bac+5 et 6 ans d\'expérience (résumé de recherche). Le seul chiffre vu (2 500 à 3 000 €, CIDJ) concerne un chef de service de sécurité incendie, un autre métier : il n\'est pas repris.',
      faitsInconnus: ['salaire', 'tarif', 'heures', 'part à distance', 'droit d\'entrée'], voisine: 'Piste A',
      sources: [ROME] }),
    fiche({ id: 'enq-F1126', rome: 'F1126', nom: 'Assistant / assistante maîtrise d\'œuvre en architecture', valorise: [],
      resume: 'Seconder un chef de projet en agence.',
      notes: 'Aucun résultat exploitable (salaire, distance).', faitsInconnus: ['salaire', 'tarif', 'heures', 'part à distance', 'droit d\'entrée'], sources: [ROME] }),
    fiche({ id: 'enq-M1822', rome: 'M1822', nom: 'Spécialiste jumeau numérique', valorise: [],
      resume: 'Données et maquette numérique d\'un ouvrage exploité ; au croisement de Revit et de la coordination.',
      notes: 'Aucune donnée trouvée sur ce métier précis : les résultats portaient sur les modeleurs et coordinateurs BIM (voir la fiche dessinateur-projeteur).',
      faitsInconnus: ['salaire', 'tarif', 'heures', 'part à distance', 'droit d\'entrée'], sources: [ROME] }),
    fiche({ id: 'enq-H1507', rome: 'H1507', nom: 'Chargé / chargée des affaires réglementaires', valorise: [],
      resume: 'Veille et conformité réglementaire dans l\'industrie (dossiers, normes) : de la synthèse réglementaire, dans un autre secteur.',
      notes: 'Non cherché séparément : aucun chiffre.', faitsInconnus: ['salaire', 'tarif', 'heures', 'part à distance', 'droit d\'entrée'], sources: [ROME] }),
    fiche({ id: 'enq-K2119', rome: 'K2119', nom: 'Consultant / consultante en ingénierie pédagogique', valorise: [],
      resume: 'Concevoir des formations (par exemple à la réglementation) : voisine de l\'idée I97 et de la formation en ligne I108.',
      notes: 'Non cherché séparément : aucun chiffre.', faitsInconnus: ['salaire', 'tarif', 'heures', 'part à distance', 'droit d\'entrée'], voisine: 'I97 · I108', sources: [ROME] })
  ];

  /* ---------- I26 et I27 : deux voies psychologie ---------- */
  var SRC_INPI = src('INPI, fiche « Psychologue » : titre réservé, licence + master mention psychologie, stage d\'au moins 500 h, achevé au plus tard un an après la formation théorique, Adeli gratuit',
    'https://www.inpi.fr/psychologue', 'officielle', true);
  var SRC_DROITS = src('Droits d\'inscription 2025-2026 : 178 € en licence, 254 € en master (Sorbonne Université, Paris 8 ; page non ouverte). CVEC en plus, non chiffrée.',
    'https://www.sorbonne-universite.fr/formation-et-vie-etudiante/candidater-et-sinscrire/modalites-dinscription-et-couts-des-etudes', 'officielle', false);
  var SRC_DISTANCE = src('Licence de psychologie à distance : Paris 8 (IED), Reims (SEAD) ; Aix-Marseille propose seulement L1 et L2 à distance (MaFormation, résumé de recherche, non ouvert)',
    'https://www.maformation.fr/actualites/licence-psychologie-distance-92830', 'commerciale', false);
  var SRC_VAE = src('Poitiers (UPPRO) : une VAE n\'ouvre pas le titre de psychologue ; dispense de licence possible selon les établissements (résumé de recherche, non ouvert)',
    'https://uppro.univ-poitiers.fr/wp-content/uploads/sites/90/2025/04/Message-psycho-pour-site-intenet-janv-2025.docx', 'officielle', false);
  var SRC_FPH = src('jobpublic.fr : psychologue hospitalier débutant, indice majoré 395, environ 1 944 € brut/mois (recoupé par le calcul indice × valeur du point ; page non ouverte)',
    'https://jobpublic.fr/blog/salaire-psychologue-hopital-2026-ce-quon-gagne-en-fph', 'commerciale', false);
  var SRC_NIMES = src('Master psychologie sociale et environnementale (Nîmes) : M1 avec licence de psychologie, M2 avec 60 ECTS de master de psychologie ; 25 places par an, sélection sur dossier et audition (résumé de recherche, non ouvert)',
    'https://orientation-environnement.fr/?p=42235', 'commerciale', false);
  var SRC_RNCP = src('Fiche certification : master mention psychologie, spécialité psychologie sociale de l\'environnement (débouchés cités : psychologue conseil en aménagement, consultant indépendant pour les acteurs de l\'environnement)',
    'https://www.intercariforef.org/formations/certification-71892.html', 'officielle', false);

  var PSYCHO = [
    fiche({ id: 'psy-titre', idee: 'I26', groupe: 'psycho', nom: 'Psychologue : le chemin vers le titre légal',
      resume: 'Licence de psychologie (3 ans) puis master mention psychologie (2 ans) avec 500 h de stage. Voir les notes : plusieurs années d\'études sans revenu.',
      revenuBas: 23328, nature: 'brut', joursSemaine: 5, distance: 'surplace', moisSansRevenu: 24,
      supposes: ['joursSemaine', 'distance', 'moisSansRevenu'],
      droitEntree: { mois: 60, euros: 1042, note: '60 mois = licence 3 ans + master 2 ans (la durée de la licence n\'est pas dans les sources ouvertes ; 3 ans est le cursus habituel). 1 042 € = 3 × 178 + 2 × 254 € de droits d\'inscription 2025-2026, hors CVEC et hors vie. Si la licence était dispensée (non établi) : 24 mois.' },
      responsabilite: 'Usage du titre sans diplôme : délit puni d\'un an de prison et 15 000 € d\'amende (INPI, loi du 25 juillet 1985, art. 44).',
      delai: 'Au moins 24 mois, probablement 60',
      notes: 'MOIS SANS REVENU : 24 est un plancher supposé (master seul). REVENU : 1 944 € brut/mois = 23 328 € brut/an pour un psychologue hospitalier débutant (site commercial). Pas de chiffre officiel de revenu des psychologues libéraux trouvé (la DREES publie pour les médecins) ; un site commercial avance 2 900 à 4 200 € net/mois pour un libéral confirmé, sans méthode : non repris. DISTANCE : la licence existe à distance dans certaines universités (Paris 8, Reims), mais le stage de 500 h est en présence et le master à distance n\'est pas établi. HEURES : poste salarié, temps plein supposé. VAE/VAPP : elle ne donne jamais le titre ; une dispense de licence pour entrer en master dépend de l\'établissement (à demander). Débouchés : poste hospitalier, scolaire, libéral, entreprise (non chiffrés ici).',
      faitsInconnus: ['revenu officiel des libéraux', 'durée réelle pour toi (dispense de licence)', 'master à distance', 'heures par semaine'],
      sources: [SRC_INPI, SRC_DROITS, SRC_DISTANCE, SRC_VAE, SRC_FPH] }),
    fiche({ id: 'psy-env', idee: 'I27', groupe: 'psycho', nom: 'Psychologie environnementale : master psychologie sociale de l\'environnement',
      resume: 'Le carrefour de la psychologie et de l\'espace. Même chemin que le titre de psychologue (licence + master de psychologie), avec une spécialité environnementale. Tarifs réels : introuvables.',
      distance: 'inconnue', moisSansRevenu: 24, supposes: ['moisSansRevenu'],
      droitEntree: { mois: 60, euros: null, note: 'Accès en M1 avec une licence de psychologie, en M2 avec 60 ECTS de master de psychologie (Nîmes). Sans licence de psychologie : voie non établie. Droits : voir la fiche du titre.' },
      delai: 'Au moins 24 mois', manque: 'Licence de psychologie, ou dispense accordée par l\'établissement',
      notes: 'FORMATIONS TROUVÉES : Nîmes (parcours psychologie sociale et environnementale, 25 places par an) ; Paris Nanterre (parcours psychologie sociale et sciences comportementales, applications à la santé, l\'environnement et la consommation) ; fiche France Compétences d\'un master « psychologie sociale de l\'environnement ». DÉBOUCHÉS CITÉS PAR LA FICHE : psychologue conseil en aménagement (expertises, évaluation, conseil aux décideurs), consultant indépendant pour les acteurs de l\'environnement, bureaux d\'études, collectivités ; d\'autres métiers cités n\'ont pas de rapport avec la voie étudiée. TARIFS RÉELS : aucun tarif ni salaire publié pour ce métier n\'a été trouvé ; seuls des repères du conseil en général (300-600 €/j junior, 600-900 € confirmé, source commerciale) existent et ne le concernent pas : RIEN N\'EST ENTRÉ dans les champs de revenu.',
      faitsInconnus: ['tarif', 'salaire', 'heures', 'part à distance', 'effectifs et insertion des diplômés'],
      sources: [SRC_NIMES, SRC_RNCP, SRC_INPI] })
  ];

  /* ---------- I24 : galerie de parcours publiés (aucune prise de contact) ---------- */
  function parcours(o) { o.contact = false; return o; }
  var PARCOURS = [
    parcours({ id: 'par-ing-bim', nom: 'Une ingénieure BIM freelance', metier: 'Ingénieure BIM freelance (gestion et modélisation de projets BIM)', pertinence: 'forte',
      dit: 'Salariée en CDI, puis freelance depuis plusieurs années ; formation de quelques mois à la gestion d\'entreprise (compta, fiscalité, social) ; travaille surtout à distance depuis un espace de coworking, rencontre ses clients une à deux fois par mission ; clients dans plusieurs pays ; assurance trouvée sans décennale en expliquant qu\'elle ne fait que modéliser des données fournies.',
      distance: 'surtout à distance (dit par elle)', heures: 'non indiqué (« pas de semaine type »)', tarif: 'non cité',
      limite: 'Ingénieure, pas architecte ; ni heures ni revenus publiés.',
      source: src('Yalink, interview publiée le 9 mars 2023, mise à jour le 26 février 2024', 'https://www.yalink.fr/blog/interview-ingenieur-bim-freelance/', 'profil', true, '2023-03-09') }),
    parcours({ id: 'par-nomade', nom: 'Une architecte devenue nomade', metier: 'Architecte, « digital nomad »', pertinence: 'moyenne',
      dit: 'Plus de 8 ans en cabinets d\'architecture (Revit dans le premier), a lancé son propre cabinet, puis a quitté ce milieu qu\'elle jugeait frustrant pour travailler et vivre en itinérance (plus de vingt pays visités).',
      distance: 'mode de vie sans lieu fixe ; part à distance non précisée', heures: 'non indiqué', tarif: 'non cité',
      limite: 'La page se contredit sur sa formation ; pas en France ; ni heures ni revenus.',
      source: src('Archgyan, épisode AG 22, publié le 2 décembre 2019, mis à jour le 13 octobre 2022', 'https://archgyan.com/being-a-digital-nomad-architect-with-shelly-agam/', 'profil', true, '2019-12-02') }),
    parcours({ id: 'par-direction', nom: 'Un architecte directeur d\'agence', metier: 'Architecte, directeur d\'une petite agence en Australie', pertinence: 'faible',
      dit: 'Dirige avec sa partenaire une petite agence d\'architecture résidentielle ; trois mois de voyage en Asie du Sud-Est avec deux membres de l\'équipe, dont il tire neuf conseils pour diriger une agence en déplacement.',
      distance: 'non précisée', heures: 'non indiqué (appels et courriels « en fin d\'après-midi »)', tarif: 'non cité',
      limite: 'Australie ; agence avec équipe ; l\'article d\'ArchDaily est réservé aux abonnés, c\'est la version d\'Archipreneur qui a été ouverte.',
      source: src('Archipreneur, 18 juin 2018 (version ArchDaily du 31 juillet 2018)', 'https://archipreneur.com/digital-nomads-architecture-9-tips-for-running-a-practice-on-the-road/', 'profil', true, '2018-06-18') }),
    parcours({ id: 'par-club', nom: 'Un architecte créateur d\'un club', metier: 'Architecte en Europe, créateur d\'un club d\'architectes en télétravail', pertinence: 'moyenne',
      dit: 'Plus de 10 ans en agences, fait une pause dans l\'architecture et cherche de nouvelles manières de travailler en gardant la maîtrise de son temps ; a créé un site collaboratif où des architectes partagent comment leurs agences travaillent à distance.',
      distance: 'télétravail comme sujet du club ; sa propre part à distance non précisée', heures: 'non indiqué', tarif: 'non cité',
      limite: 'Article de lancement de 2020 (période du confinement), écrit par un tiers ; ancien.',
      source: src('ABCD blog, 7 avril 2020', 'https://www.abcdblog.fr/le-club-international-des-architectes-en-teletravail-est-lance-a-vous-de-participer-decouvrir-et-partager-sur-cette-nouvelle-maniere-de-travailler/', 'profil', true, '2020-04-07') }),
    parcours({ id: 'par-salarie', nom: 'Un architecte BIM manager salarié', metier: 'Architecte HMONP, chef de projet et BIM manager salarié en agence', pertinence: 'contre-exemple',
      dit: 'Travaillait à l\'agence pendant les vacances puis à mi-temps (environ deux jours par semaine en suivi de chantier) pendant son master ; temps plein dès son diplôme, avec chantiers et direction des travaux ; devient référent BIM.',
      distance: 'télétravail non mentionné', heures: 'temps plein (statut de salarié non écrit)', tarif: 'non cité',
      limite: 'Salarié, chantier, heures pleines. Gardé comme point de comparaison. Interview ancienne.',
      source: src('Lightzoom Lumière, interview publiée le 7 novembre 2017', 'https://www.lightzoomlumiere.fr/interview/y-a-plusieurs-echelles-de-bim-manager-mael-clavier/', 'profil', true, '2017-11-07') }),
    /* Bureau d'études en accessibilité : cinq profils publiés par l'entreprise sur sa propre page ; aucun nom repris ici */
    parcours({ id: 'par-acces-psychosocio', nom: 'Membre de l\'équipe d\'un bureau d\'études en accessibilité (profil publié par l\'entreprise)', metier: 'Architecte DPLG, parcours en psycho-sociologie de l\'architecture, consultante accès', pertinence: 'forte',
      dit: 'Un parcours d\'architecte avec une formation en psycho-sociologie architecturale devenu conseil en accessibilité, dans un bureau d\'études qui fait aussi de la formation (Qualiopi).',
      distance: 'non indiqué ', heures: 'non indiqué', tarif: 'non publié',
      limite: 'Profil de présentation publié par l\'entreprise, pas un récit de parcours ; statut (salarié ou associé) non indiqué.',
      source: src('Page d\'équipe d\'un bureau d\'études en accessibilité', 'https://liessaccess.fr/', 'profil', true) }),
    parcours({ id: 'par-acces-archi', nom: 'Membre de l\'équipe d\'un bureau d\'études en accessibilité (profil publié par l\'entreprise)', metier: 'Architecte DPLG, consultant accessibilité', pertinence: 'forte',
      dit: 'Architecte diplômé exerçant le conseil en accessibilité : diagnostics d\'ERP, dossiers d\'autorisation de travaux, suivi des Ad\'AP, registre public d\'accessibilité.',
      distance: 'non indiqué', heures: 'non indiqué', tarif: 'non publié',
      limite: 'Même limite que ci-dessus ; la part à distance de ces diagnostics n\'est pas dite.',
      source: src('Page d\'équipe d\'un bureau d\'études en accessibilité', 'https://liessaccess.fr/', 'profil', true) }),
    parcours({ id: 'par-acces-interieur', nom: 'Membre de l\'équipe d\'un bureau d\'études en accessibilité (profil publié par l\'entreprise)', metier: 'Architecte d\'intérieur, conseil en accessibilité et en adaptation de logements', pertinence: 'moyenne',
      dit: 'Architecte d\'intérieur qui applique son métier à l\'adaptation de logements et à l\'accessibilité.',
      distance: 'non indiqué', heures: 'non indiqué', tarif: 'non publié',
      limite: 'Même limite que ci-dessus.',
      source: src('Page d\'équipe d\'un bureau d\'études en accessibilité', 'https://liessaccess.fr/', 'profil', true) }),
    parcours({ id: 'par-acces-ergo', nom: 'Membre de l\'équipe d\'un bureau d\'études en accessibilité (profil publié par l\'entreprise)', metier: 'Ergonome et formatrice (adaptation de postes de travail, qualité de vie au travail)', pertinence: 'moyenne',
      dit: 'Un profil d\'ergonome qui forme et adapte des postes : le métier voisin de la psychologie de l\'espace vu dans la fiche M1412.',
      distance: 'non indiqué', heures: 'non indiqué', tarif: 'non publié',
      limite: 'Même limite que ci-dessus.',
      source: src('Page d\'équipe d\'un bureau d\'études en accessibilité', 'https://liessaccess.fr/', 'profil', true) }),
    parcours({ id: 'par-acces-psy', nom: 'Membre de l\'équipe d\'un bureau d\'études en accessibilité (profil publié par l\'entreprise)', metier: 'Psychologue spécialiste du FALC (français facile à lire et à comprendre)', pertinence: 'moyenne',
      dit: 'Une psychologue dans une équipe d\'accessibilité du bâti : un exemple de psychologie qui travaille avec des architectes et des bureaux d\'études.',
      distance: 'non indiqué', heures: 'non indiqué', tarif: 'non publié',
      limite: 'Même limite que ci-dessus.',
      source: src('Page d\'équipe d\'un bureau d\'études en accessibilité', 'https://liessaccess.fr/', 'profil', true) })
  ];


  /* =====================================================================================================
     Élargissement : tous les métiers, repères officiels par catégorie,
     activités écartées. Les repères officiels portent sur une CATÉGORIE LARGE (cadres, professions intermédiaires…), jamais sur le métier. */
  GROUPES.large = 'Tous métiers du ROME';

  var SRC_INSEE_TELE = src('Insee Références, Économie et société à l\'ère du numérique, édition 2025, fiche 3.4 « Pratique du télétravail » (Dares, enquêtes Conditions de travail 2019, Tracov 1 et 2) : en 2023, 26 % des salariés télétravaillent même occasionnellement, 65 % des cadres, 28 % des professions intermédiaires, 11 % des employés, presque aucun ouvrier ; 5 % des salariés télétravaillent 3 jours ou plus par semaine ; 60 % jugent leur poste non télétravaillable',
    'https://www.insee.fr/fr/statistiques/8616841', 'officielle', true, '2025');
  var SRC_INSEE_SALAIRES = src('Insee Références, « Salaires dans le secteur privé : caractéristiques des individus », publié le 26/06/2025, figure 1 : salaire mensuel net moyen en équivalent temps plein en 2023, secteur privé : cadres 4 570 €, professions intermédiaires 2 660 €, employés 1 960 €, ouvriers 2 030 €',
    'https://www.insee.fr/fr/statistiques/8376872', 'officielle', true, '2025-06-26');
  var SRC_INSEE_HORAIRE = src('Insee (enquête Structure des salaires 2022, étude de mars 2025, lue dans un résultat de recherche) : salaire horaire BRUT moyen des cadres 33,5 €, des professions intermédiaires 19,4 €, des employés 14,6 €',
    'https://www.insee.fr/fr/statistiques/8382421', 'officielle', false, '2025-03');

  /* repères par catégorie : montants nets mensuels en équivalent temps plein, 2023 ; net horaire = net mensuel ÷ 151,67 h (35 h × 52 ÷ 12, SUPPOSÉ) */
  var CATEGORIES = {
    cadres: { nom: 'cadres', netMensuelEqtp: 4570, teletravail2023: 65, brutHoraire2022: 33.5 },
    intermediaire: { nom: 'professions intermédiaires', netMensuelEqtp: 2660, teletravail2023: 28, brutHoraire2022: 19.4 },
    employe: { nom: 'employés', netMensuelEqtp: 1960, teletravail2023: 11, brutHoraire2022: 14.6 }
  };
  var HEURES_MOIS = 151.67;
  function netHoraire(c) { return Math.round(c.netMensuelEqtp / HEURES_MOIS * 10) / 10; }
  function repereTexte(cat) {
    var c = CATEGORIES[cat];
    return ' REPÈRE OFFICIEL (catégorie large « ' + c.nom + ' », pas le métier ; le classement du métier dans cette catégorie est un jugement de l\'auteur, donc supposé) : salaire net moyen ' +
      c.netMensuelEqtp + ' €/mois en équivalent temps plein, secteur privé, 2023, soit environ ' + String(netHoraire(c)).replace('.', ',') + ' € net par heure à 35 h par semaine (calcul supposé) ; ' +
      c.teletravail2023 + ' % de cette catégorie télétravaillent, même occasionnellement, en 2023 ; 5 % de tous les salariés télétravaillent 3 jours ou plus par semaine, et 60 % jugent leur poste non télétravaillable (Insee, Dares).';
  }
  /* catégorie (supposée) de chaque fiche des deux premiers passages */
  var CAT_PREMIER = {
    'enq-F1103': 'intermediaire', 'enq-F1114': 'intermediaire', 'enq-F1120': 'cadres', 'enq-F1130': 'cadres', 'enq-F1104': 'intermediaire',
    'enq-K1807': 'cadres', 'enq-M1412': 'cadres', 'enq-K2111': 'intermediaire', 'enq-M1413': 'cadres', 'enq-C1501': 'intermediaire',
    'enq-F1135': 'cadres', 'enq-H1207': 'intermediaire', 'enq-F1102': 'intermediaire', 'enq-F1113': 'cadres', 'enq-K1903': 'cadres',
    'enq-C1506': 'cadres', 'enq-H1313': 'cadres', 'enq-F1126': 'intermediaire', 'enq-M1822': 'cadres', 'enq-H1507': 'cadres', 'enq-K2119': 'cadres',
    'psy-titre': 'cadres', 'psy-env': 'cadres'
  };

  function lg(o) {
    o.groupe = 'large';
    o.idee = 'I21';
    o.sources = [ROME].concat(o.sources || []);
    if (o.salarie) { o.joursSemaine = 5; o.supposes = (o.supposes || []).concat(['joursSemaine']); }
    var f = fiche(o);
    f.categorie = o.categorie;
    f.euroHeureBas = o.euroHeureBas === undefined ? null : o.euroHeureBas;
    f.euroHeureHaut = o.euroHeureHaut === undefined ? null : o.euroHeureHaut;
    f.euroHeureNature = o.euroHeureNature || '';
    return f;
  }
  var comm = function (texte, url) { return src(texte + ' (page non ouverte)', url, 'commerciale', false); };
  var NOTE_ANNEE2 = ' Brut annuel = brut mensuel × 12 quand la source donne un mois ; débutant ; temps plein supposé.';
  var NOTE_TJM = ' Un tarif journalier (HT) n\'est pas un salaire : cotisations, impôts, frais et jours sans mission viennent en moins.';
  var INCONNU = ['salaire', 'tarif', 'heures', 'part à distance', 'délai avant le premier revenu', 'droit d\'entrée'];

  var LARGE = [
    lg({ id: 'lg-M1855', rome: 'M1855', nom: 'Développeur / développeuse web et web mobile', categorie: 'intermediaire', valorise: [], salarie: true,
      resume: 'Entrée par un titre professionnel (niveau 5) d\'environ un an ; télétravail fréquent dans l\'informatique (non chiffré pour ce métier).',
      revenuBas: 30000, revenuHaut: 45000, tarifBas: 350, tarifHaut: 450, joursSemaine: 5, distance: 'inconnue', moisSansRevenu: 10, supposes: ['moisSansRevenu'],
      droitEntree: { mois: 10, euros: 4490, note: 'Titre professionnel développeur web et web mobile (niveau 5, RNCP37674) : environ 9 à 10 mois, 1 073 à 1 258 heures ; 4 490 € (offre en ligne éligible CPF) à 12 984 € (Afpa à distance) ; gratuit pour le bénéficiaire dans une formation prise en charge par la Région (Greta Aquitaine), sur test de positionnement. Aucun taux d\'insertion trouvé : méfie-toi des formations chères sans preuve de résultats.' },
      delai: '10 mois de formation au moins (supposé : à temps plein, sans revenu)',
      notes: 'Salaire junior : 30 à 45 k€ brut/an selon deux guides commerciaux (front-end 30-38, full-stack 35-45). TJM junior : 350 à 450 €/jour, médian 2026 environ 535 € (sites commerciaux). Le délai avant le premier revenu est supposé : la durée de la formation est sourcée, pas la recherche d\'un premier poste.' + NOTE_ANNEE2 + NOTE_TJM,
      faitsInconnus: ['part à distance du métier', 'heures', 'délai de première mission'],
      sources: [comm('esiea.fr, salaire développeur web 2026', 'https://www.esiea.fr/metier-de-developpeur-salaires-et-perspectives/'),
        comm('factoriel.fr, grille des salaires IT 2026', 'https://www.factoriel.fr/grille-salaires-it-data-ia-2026/'),
        comm('captainfreelance.com, TJM 2026', 'https://www.captainfreelance.com/article/tjm-freelance-2026'),
        src('Afpa, formation à distance développeur web et web mobile (page non ouverte)', 'https://www.afpa.fr/formation-qualifiante/formation-a-distance-developpeur-web-et-web-mobile-option-anglais', 'publique', false),
        src('Greta CFA Aquitaine, titre professionnel développeur web et web mobile (page non ouverte)', 'https://greta-cfa-aquitaine.fr/fiches/titre-professionnel-developpeur-web-et-web-mobile/?format=pdf', 'publique', false)] }),
    lg({ id: 'lg-M1419', rome: 'M1419', nom: 'Data analyst', categorie: 'cadres', valorise: [], salarie: true,
      resume: 'Analyser des données pour une entreprise ; forte part d\'informatique.', revenuBas: 32000, revenuHaut: 46000, tarifBas: 280, tarifHaut: 380,
      notes: 'Salaire débutant : 38-46 k€ (un baromètre) ou 32-40 k€ (un autre guide), commerciaux. TJM junior 280 à 380 €, médian 500 € (commercial).' + NOTE_ANNEE2 + NOTE_TJM,
      faitsInconnus: ['part à distance', 'heures', 'délai avant le premier revenu', 'droit d\'entrée'],
      sources: [comm('factoriel.fr, grille des salaires IT 2026', 'https://www.factoriel.fr/grille-salaires-it-data-ia-2026/'), comm('postules.fr, TJM freelance IT 2026', 'https://postules.fr/blog/tjm-freelance-it-2026')] }),
    lg({ id: 'lg-M1814', rome: 'M1814', nom: 'Scrum master', categorie: 'cadres', valorise: [], salarie: true,
      resume: 'Animer une équipe de projet agile : de la coordination.', revenuBas: 42000, revenuHaut: 50000, tarifBas: 350, tarifHaut: 480,
      notes: 'Junior : 42 à 50 k€ brut/an (un baromètre commercial) ; TJM de départ 350 à 480 €, médian 600 €. Aucune source ne dit comment entrer sans expérience en projets informatiques.' + NOTE_ANNEE2 + NOTE_TJM,
      faitsInconnus: ['part à distance', 'heures', 'délai avant le premier revenu', 'droit d\'entrée'],
      sources: [comm('factoriel.fr, grille des salaires IT 2026', 'https://www.factoriel.fr/grille-salaires-it-data-ia-2026/'), comm('captainfreelance.com, TJM 2026', 'https://www.captainfreelance.com/article/tjm-freelance-2026')] }),
    lg({ id: 'lg-M1827', rome: 'M1827', nom: 'Ingénieur / ingénieure DevOps', categorie: 'cadres', valorise: [], salarie: true,
      resume: 'Automatiser le déploiement de logiciels ; entrée très technique.', revenuBas: 38000, revenuHaut: 50000, tarifBas: 350, tarifHaut: 450,
      notes: 'Junior : 38 à 45 k€ (Marseille) ou 42 à 50 k€ (national) ; TJM junior 350 à 450 € (sites commerciaux, écarts du simple au double selon les sources).' + NOTE_ANNEE2 + NOTE_TJM,
      faitsInconnus: ['part à distance', 'heures', 'délai avant le premier revenu', 'droit d\'entrée'],
      sources: [comm('jobrise.io, combien gagne un DevOps engineer 2026', 'https://jobrise.io/fr/blog/combien-gagne-un-devops-engineer-2026/')] }),
    lg({ id: 'lg-M1866', rome: 'M1866', nom: 'Pentesteur / pentesteuse (tests d\'intrusion)', categorie: 'cadres', valorise: [], salarie: false,
      resume: 'Tester la sécurité informatique d\'un client.', tarifBas: 350, tarifHaut: 480,
      notes: 'TJM junior 350 à 480 €, médian 415 € (simulateur non officiel) ; aucun salaire junior fiable trouvé (cybersécurité en général : 35 à 50 k€ entre 0 et 3 ans selon une source commerciale, non reprise comme revenu de ce métier).' + NOTE_TJM,
      faitsInconnus: ['salaire', 'part à distance', 'heures', 'délai avant le premier revenu', 'droit d\'entrée'],
      sources: [ti('simulateur-tjm/cybersecurite-reseaux/pentester/junior', 'travail-industrie.com, pentester junior')] }),
    lg({ id: 'lg-K1906', rome: 'K1906', nom: 'Délégué / déléguée à la protection des données (DPO)', categorie: 'cadres', valorise: [], salarie: true,
      resume: 'Conformité réglementaire (RGPD) : de la synthèse réglementaire écrite.',
      notes: 'Aucun salaire junior : le baromètre cité donne 55 à 70 k€ pour un profil confirmé de 2 à 5 ans, qui suppose une expérience préalable (non repris comme revenu d\'entrée). Formation et droit d\'entrée : non cherchés.',
      faitsInconnus: INCONNU, sources: [comm('factoriel.fr, grille des salaires IT 2026', 'https://www.factoriel.fr/grille-salaires-it-data-ia-2026/')] }),
    lg({ id: 'lg-E1108', rome: 'E1108', nom: 'Traducteur / traductrice indépendant(e)', categorie: 'employe', valorise: [], salarie: false,
      resume: 'Profession non réglementée, aucun diplôme exigé (sources commerciales) .',
      tarifBas: 250, tarifHaut: 500, euroHeureBas: 25, euroHeureHaut: 70, euroHeureNature: 'facturé HT',
      droitEntree: { mois: null, euros: null, note: 'Aucun diplôme exigé et profession non réglementée (guides commerciaux) ; cadre de micro-entreprise. Durée et coût pour devenir crédible : non relevés.' },
      notes: 'Tarifs : 0,05 à 0,20 € le mot ; 70 à 120 € les 1 000 mots en anglais-français ; 25 à 70 € de l\'heure ; TJM 250 à 500 € (technique et juridique plus chers). Revenu net annoncé : 1 500 à 2 500 €/mois pour un débutant, 20 à 40 k€ net par an à temps plein avec portefeuille stable (guides commerciaux). Pas de source sur le niveau de langue requis.' + NOTE_TJM,
      faitsInconnus: ['part à distance (travail sur texte, probablement élevée : supposé)', 'heures', 'délai avant le premier revenu', 'niveau de langue requis'],
      sources: [comm('c-traduction.fr, tarif traducteur freelance 2026', 'https://www.c-traduction.fr/articles/tarif-traducteur-freelance/'), comm('abby.fr, devenir traducteur freelance', 'https://abby.fr/guide/micro-entreprise/devenir-traducteur-freelance')] }),
    lg({ id: 'lg-E1101', rome: 'E1101', nom: 'Community manager', categorie: 'intermediaire', valorise: [], salarie: true,
      resume: 'Animer les réseaux sociaux d\'une organisation (le compte de l\'organisation, pas un compte personnel).', revenuBas: 26760,
      droitEntree: { mois: null, euros: null, note: 'Onisep (fiche reprise par Orientest) : niveau bac+3.' },
      notes: 'Onisep : à partir de 2 230 € brut/mois (mars 2025, via Orientest, page non ouverte) ; d\'autres sites : environ 2 000 € brut/mois et 2 407 € en moyenne. Plancher seul : la fiche ne donne pas de haut de fourchette.' + NOTE_ANNEE2,
      faitsInconnus: ['part à distance', 'heures', 'délai avant le premier revenu'],
      sources: [src('Onisep, fiche « Community manager » reprise par Orientest (page non ouverte)', 'https://recherche.orientest.fr/download_pdf/metier/2808b696464c7ebb94ed89b53b733a', 'publique', false)] }),
    lg({ id: 'lg-E1119', rome: 'E1119', nom: 'Concepteur-rédacteur / rédacteur web', categorie: 'intermediaire', valorise: [], salarie: true,
      resume: 'Écrire des contenus pour des sites ; du travail écrit.',
      droitEntree: { mois: null, euros: null, note: 'Onisep (rédacteur en ligne) : niveau bac+3.' },
      notes: 'Onisep (rédacteur en ligne) : débutant 1 867 €, sans préciser brut ou net : AUCUN revenu saisi pour ne pas inventer la nature du chiffre. Aucun tarif de rédacteur indépendant trouvé.',
      faitsInconnus: ['revenu (nature du chiffre Onisep incertaine)', 'tarif', 'part à distance', 'heures', 'délai avant le premier revenu'],
      sources: [src('Onisep, fiche « Rédacteur en ligne » (page non ouverte)', 'https://www.onisep.fr/ressources/univers-metier/metiers/redacteur-redactrice-on-line-en-ligne/pdf', 'officielle', false)] }),
    lg({ id: 'lg-E1121', rome: 'E1121', nom: 'Secrétaire de rédaction, correcteur', categorie: 'intermediaire', valorise: [], salarie: true,
      resume: 'Relire et corriger des textes.', notes: 'Aucun résultat exploitable (salaire, tarif, distance).', faitsInconnus: INCONNU }),
    lg({ id: 'lg-M1507', rome: 'M1507', nom: 'Gestionnaire de paie', categorie: 'intermediaire', valorise: [], salarie: true,
      resume: 'Établir les paies en appliquant le droit du travail et les conventions : de la réglementation, en bureau.',
      revenuBas: 19200, revenuHaut: 27600, moisSansRevenu: 6, supposes: ['moisSansRevenu'],
      droitEntree: { mois: 6, euros: 2590, note: 'Titre souvent présenté comme bac+2 ; formation d\'environ 300 heures sur 4 à 6 mois (certains la finissent en 6 à 18 mois), à partir de 159 € par mois ou 2 590 € selon l\'organisme (0 à 10 000 € selon les sources), financement CPF possible.' },
      delai: 'Au moins 4 à 6 mois de formation (supposé : sans revenu)',
      notes: 'Débutant : 1 600 à 2 300 € brut/mois selon trois sources commerciales. Le salaire est le plus bas du lot ; l\'entrée est courte.' + NOTE_ANNEE2,
      faitsInconnus: ['part à distance', 'heures', 'délai de recherche d\'un premier poste'],
      sources: [comm('diplomeo.com, fiche métier gestionnaire de paie', 'https://diplomeo.com/formations-metier-pour-devenir-gestionnaire_de_paie'), comm('youschool.fr, prix d\'une formation de gestionnaire de paie', 'https://www.youschool.fr/formation-paie/prix/'),
        comm('la-paie-facile.com, formation gestionnaire de paie 2026', 'https://la-paie-facile.com/formation-gestionnaire-de-paie-2/')] }),
    lg({ id: 'lg-M1203', rome: 'M1203', nom: 'Comptable', categorie: 'intermediaire', valorise: [], salarie: true,
      resume: 'Tenir les comptes d\'une entreprise ou d\'un cabinet ; du télétravail partiel selon l\'employeur.',
      revenuBas: 32400, revenuHaut: 35000, distance: 'partielle', supposes: ['distance'],
      droitEntree: { mois: 24, euros: null, note: 'Bac+2 (BTS) cité par des guides commerciaux (CNED, Studi) ; assistant comptable : niveau bac. Coût non relevé.' },
      notes: 'Comptable débutant : 2 700 € brut/mois (guide commercial) ou 28,6 à 35 k€ brut/an ; assistant comptable : 1 800 à 2 100 € brut/mois (non repris). Télétravail : 1 à 2 jours par semaine selon l\'employeur, quelques cabinets à distance complète (guide commercial : « partielle » est supposé).' + NOTE_ANNEE2,
      faitsInconnus: ['heures', 'délai avant le premier revenu'],
      sources: [src('CNED, devenir comptable (page non ouverte)', 'https://www.cned.fr/metiers/devenir-comptable-metier-formation-salaire', 'publique', false), comm('l-expert-comptable.com, salaire assistant comptable', 'https://www.l-expert-comptable.com/a/533816-assistant-comptable-metier-salaire-formation-diplomes.html')] }),
    lg({ id: 'lg-C1205', rome: 'C1205', nom: 'Conseiller / conseillère en gestion de patrimoine (profession réglementée)', categorie: 'cadres', valorise: [], salarie: true,
      resume: 'Métier de conseil réglementé (immatriculation ORIAS) : distinct d\'une activité de placement personnel ; cette fiche ne donne aucun conseil de placement.',
      revenuBas: 34992, droitEntree: { mois: null, euros: null, note: 'Onisep : niveau d\'accès bac+5 (niveau bac+5) ; statut réglementé : ORIAS, compétence professionnelle et honorabilité (CNCGP, AMF) ; un site commercial dit que le statut d\'auto-entrepreneur n\'est pas possible. Durée et coût de la mise en conformité : non relevés.' },
      notes: 'Onisep : 2 916 € brut/mois au départ ; sites commerciaux : 25 à 35 k€ ou 30 à 40 k€ brut/an ; part variable fréquente. Plancher seul retenu : la fiche Onisep.' + NOTE_ANNEE2,
      faitsInconnus: ['part à distance', 'heures', 'délai avant le premier revenu', 'coût et durée d\'une mise en conformité'],
      sources: [onisep('gestionnaire-de-patrimoine', 'Onisep, fiche « Gestionnaire de patrimoine » (page non ouverte)'),
        src('CNCGP, la profession de CGP : activités et conditions d\'accès (mars 2025 ; page non ouverte)', 'https://www.cncgp.fr/uploads/adhesion/2025/La-profession-de-CGP-Activites-et-conditions-d-acces-03.2025.pdf', 'profil', false)] }),
    lg({ id: 'lg-M1718', rome: 'M1718', nom: 'Consultant / consultante SEO (référencement), marketing digital', categorie: 'intermediaire', valorise: [], salarie: false,
      resume: 'Faire apparaître des sites dans les moteurs de recherche, en freelance le plus souvent.', tarifBas: 281, tarifHaut: 497,
      notes: 'TJM : 281 € (0-2 ans) à 494-497 € en moyenne, 592 € au-delà de 15 ans ; spécialistes 600 à 900 € (sites commerciaux). Aucun salaire cherché.' + NOTE_TJM,
      faitsInconnus: ['salaire', 'part à distance', 'heures', 'délai avant le premier revenu', 'droit d\'entrée'],
      sources: [comm('lefreelance.fr, TJM consultant SEO 2026', 'https://lefreelance.fr/articles/tjm-consultant-seo-freelance/')] }),
    lg({ id: 'lg-H1204', rome: 'H1204', nom: 'Designer (UX / UI) freelance', categorie: 'intermediaire', valorise: [], salarie: false,
      resume: 'Concevoir des interfaces ; le rapprochement entre « UX designer » et cette fiche du ROME est de mon fait.', tarifBas: 300, tarifHaut: 450,
      notes: 'TJM junior 300 à 450 €, médian 450 € (300-650 selon l\'observatoire) ; sites commerciaux.' + NOTE_TJM,
      faitsInconnus: ['salaire', 'part à distance', 'heures', 'délai avant le premier revenu', 'droit d\'entrée'],
      sources: [comm('freelance-ou-cdi.fr, observatoire du TJM 2026', 'https://freelance-ou-cdi.fr/observatoire-tjm-2026/')] }),
    /* métiers repérés sans aucun chiffre trouvé */
    lg({ id: 'lg-M1801', rome: 'M1801', nom: 'Administrateur / administratrice de systèmes d\'information (SI)', categorie: 'cadres', valorise: [], salarie: true, resume: 'Faire fonctionner les systèmes informatiques d\'une organisation.', notes: 'Aucun chiffre trouvé.', faitsInconnus: INCONNU }),
    lg({ id: 'lg-M1864', rome: 'M1864', nom: 'Product owner', categorie: 'cadres', valorise: [], salarie: true, resume: 'Piloter le contenu d\'un produit numérique.', notes: 'Aucun chiffre trouvé.', faitsInconnus: INCONNU }),
    lg({ id: 'lg-M1812', rome: 'M1812', nom: 'Responsable de la sécurité des systèmes d\'information (RSSI)', categorie: 'cadres', valorise: [], salarie: true, resume: 'Politique de sécurité informatique d\'une organisation ; entrée longue (supposé).', notes: 'Aucun chiffre trouvé.', faitsInconnus: INCONNU }),
    lg({ id: 'lg-M1860', rome: 'M1860', nom: 'Architecte cloud', categorie: 'cadres', valorise: [], salarie: true, resume: 'Concevoir des infrastructures informatiques en ligne.', notes: 'Aucun chiffre trouvé.', faitsInconnus: INCONNU }),
    lg({ id: 'lg-M1405', rome: 'M1405', nom: 'Data scientist', categorie: 'cadres', valorise: [], salarie: true, resume: 'Modèles statistiques et apprentissage automatique.', notes: 'Aucun chiffre trouvé.', faitsInconnus: INCONNU }),
    lg({ id: 'lg-M1889', rome: 'M1889', nom: 'Ingénieur / ingénieure en intelligence artificielle', categorie: 'cadres', valorise: [], salarie: true, resume: 'Développer des systèmes d\'IA.', notes: 'Aucun chiffre trouvé.', faitsInconnus: INCONNU }),
    lg({ id: 'lg-M1806', rome: 'M1806', nom: 'Consultant fonctionnel des systèmes d\'information', categorie: 'cadres', valorise: [], salarie: true, resume: 'Traduire les besoins d\'un métier en solution informatique : de la coordination.', notes: 'Aucun chiffre trouvé.', faitsInconnus: INCONNU }),
    lg({ id: 'lg-M1429', rome: 'M1429', nom: 'Consultant / consultante en management', categorie: 'cadres', valorise: [], salarie: true, resume: 'Conseil en organisation pour des entreprises.', notes: 'Aucun chiffre trouvé.', faitsInconnus: INCONNU }),
    lg({ id: 'lg-M1402', rome: 'M1402', nom: 'Responsable en organisation en entreprise', categorie: 'cadres', valorise: [], salarie: true, resume: 'Organiser les processus d\'une entreprise.', notes: 'Aucun chiffre trouvé.', faitsInconnus: INCONNU }),
    lg({ id: 'lg-M1502', rome: 'M1502', nom: 'Chargé / chargée de recrutement', categorie: 'intermediaire', valorise: [], salarie: true, resume: 'Recruter pour une entreprise ou un cabinet.', notes: 'Aucun chiffre trouvé.', faitsInconnus: INCONNU }),
    lg({ id: 'lg-M1508', rome: 'M1508', nom: 'Conseiller / conseillère en gestion de carrière, coach professionnel', categorie: 'intermediaire', valorise: [], salarie: false, resume: 'Accompagner des personnes dans leur parcours ; tarifs et formations non cherchés.', notes: 'Aucun chiffre trouvé (les tarifs de coach n\'ont pas été cherchés ; attention aux formations coûteuses sans preuve de résultats).', faitsInconnus: INCONNU }),
    lg({ id: 'lg-K2130', rome: 'K2130', nom: 'Professeur / professeure de français langue étrangère (FLE)', categorie: 'intermediaire', valorise: [], salarie: false, resume: 'Enseigner le français à des étrangers, en ligne possible (supposé).', notes: 'Aucun chiffre trouvé.', faitsInconnus: INCONNU }),
    lg({ id: 'lg-K2126', rome: 'K2126', nom: 'Conseiller / conseillère en validation des acquis de l\'expérience', categorie: 'intermediaire', valorise: [], salarie: true, resume: 'Accompagner des candidats à la VAE.', notes: 'Aucun chiffre trouvé.', faitsInconnus: INCONNU }),
    lg({ id: 'lg-K2132', rome: 'K2132', nom: 'Responsable ingénierie de la formation professionnelle', categorie: 'cadres', valorise: [], salarie: true, resume: 'Concevoir des dispositifs de formation.', notes: 'Aucun chiffre trouvé.', faitsInconnus: INCONNU }),
    lg({ id: 'lg-M1204', rome: 'M1204', nom: 'Contrôleur / contrôleuse de gestion', categorie: 'cadres', valorise: [], salarie: true, resume: 'Suivre et analyser les budgets d\'une organisation.', notes: 'Aucun chiffre trouvé.', faitsInconnus: INCONNU }),
    lg({ id: 'lg-M1205', rome: 'M1205', nom: 'Directeur / directrice administratif et financier (DAF)', categorie: 'cadres', valorise: [], salarie: true, resume: 'Direction financière d\'une entreprise ; entrée longue (supposé : métier d\'expérience).', notes: 'Aucun chiffre trouvé.', faitsInconnus: INCONNU })
  ];

  /* activités écartées de la liste des métiers : ce ne sont pas des métiers recommandés, ou elles sont signalées comme pièges */
  var GRILLE = 'Grille de critères : pièges à éviter';
  var ECARTES = [
    { id: 'ec-appoint', nom: 'Petites activités d\'appoint : revente d\'objets, garde d\'animaux, assistance virtuelle à la tâche sur plateforme, et équivalents', raison: 'Seulement de vrais métiers. Aucune de ces activités n\'a de fiche, ne figure dans le classement, ni n\'est proposée par le générateur de croisements ou par la récolte.', source: 'Périmètre de l\'app : seulement de vrais métiers', regle: 'petite activité' },
    { id: 'ec-trading', nom: 'Trading, spéculation, placements pour compte propre (bourse, cryptomonnaies, produits dérivés)', raison: 'Une activité d\'investissement, pas un métier : aucune fiche, aucun classement, aucun conseil. Les métiers de marché salariés du ROME (trader C1301, opérateur sur marchés C1305) ne sont pas repris : aucune donnée de revenu ou de distance trouvée, entrée longue (supposé).', source: GRILLE, regle: 'activité d\'investissement' },
    { id: 'ec-placement', nom: 'Parc locatif, LMNP, viager, investissement long terme comme « second salaire »', raison: 'Description seulement (fiches I109 et I110 de l\'app) ; aucun conseil de placement. Pas de revenu présenté comme un métier.', source: 'Fiches I109 et I110 de l\'app', regle: 'activité d\'investissement' },
    { id: 'ec-mlm', nom: 'Vente multiniveau, réseaux où il faut recruter d\'autres personnes', raison: 'Écartée : « les business qui demandent de recruter d\'autres personnes (risque de pyramide) ».', source: GRILLE, regle: 'piège' },
    { id: 'ec-promesses', nom: 'Promesses de revenus faciles et rapides', raison: 'Écartées : aucune fiche ne reprend un revenu promis sans source indépendante.', source: GRILLE, regle: 'piège' },
    { id: 'ec-formations', nom: 'Formations coûteuses sans preuve de résultats', raison: 'Signalées dans les fiches concernées (développeur web : 4 490 à 12 984 €, aucun taux d\'insertion trouvé ; coach : non cherché).', source: GRILLE, regle: 'piège' },
    { id: 'ec-invest-initial', nom: 'Investissement initial important avant demande prouvée', raison: 'Les coûts d\'entrée sont affichés quand une source les donne ; sinon « non relevé ».', source: GRILLE, regle: 'piège' }
  ];

  /* application des repères officiels aux fiches des trois passages, une seule fois */
  var TOUTES = METIERS.concat(PSYCHO, LARGE);
  TOUTES.forEach(function (f) {
    var cat = CAT_PREMIER[f.id] || f.categorie;
    f.categorie = cat;
    f.categorieSupposee = true;
    f.notes = (f.notes || '') + repereTexte(cat);
    if (!f.sources.some(function (x) { return x === SRC_INSEE_TELE; })) f.sources = f.sources.concat([SRC_INSEE_TELE, SRC_INSEE_SALAIRES, SRC_INSEE_HORAIRE]);
    var m = f.droitEntree && f.droitEntree.mois;
    f.entree = (m === null || m === undefined) ? 'inconnue' : (m <= 6 ? 'courte' : (m <= 12 ? 'moyenne' : 'longue'));
  });
  METIERS.concat(PSYCHO).forEach(function (f) { f.euroHeureBas = null; f.euroHeureHaut = null; f.euroHeureNature = ''; });

  /* installation dans les données du lot 1 : fiches et groupes */
  var installe = false;
  function installer(D) {
    if (installe) return;
    installe = true;
    for (var g in GROUPES) D.GROUPES[g] = GROUPES[g];
    METIERS.concat(PSYCHO, LARGE).forEach(function (f) { D.PISTES.push(f); });
  }
  if (typeof MetierDonnees !== 'undefined') installer(MetierDonnees);

  /* Une fiche respecte « réellement » des critères quand, chiffres à l'appui : la distance est principale ou totale ET sourcée (pas « supposée »),
     et le mois sans revenu est connu et ≤ à la marge donnée, et un revenu est connu. Rien de supposé ne compte. Sans marge donnée, aucune fiche ne respecte. */
  function respecteLesCriteres(f, marge) {
    var m = f.moisSansRevenu;
    var distanceSure = (f.distance === 'totale' || f.distance === 'principale') && (f.supposes || []).indexOf('distance') < 0;
    var margeSure = marge !== undefined && marge !== null && m !== null && m !== undefined && m <= marge && (f.supposes || []).indexOf('moisSansRevenu') < 0;
    var revenuConnu = f.revenuBas !== null || f.tarifBas !== null;
    return !!(distanceSure && margeSure && revenuConnu);
  }

  return { METIERS: METIERS, PSYCHO: PSYCHO, LARGE: LARGE, ECARTES: ECARTES, CATEGORIES: CATEGORIES, netHoraire: netHoraire, PARCOURS: PARCOURS, NATURES: NATURES, GROUPES: GROUPES, JOUR: JOUR,
    respecteLesCriteres: respecteLesCriteres, installer: installer };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = MetierEnquete;
