# Pour Claude : dépôt PUBLIC, code seulement

Ce dépôt est public (servi par GitHub Pages). Il ne doit contenir **que le code** de l'app : `index.html`, `sw.js`, `monde.js`, manifestes, icônes de l'app, `tests/`, `passerelle/`.

Interdit ici, même temporairement (l'historique git est public) :
- toute capture d'écran de la vraie carte, maquette ou planche de design ;
- `PRODUIT.md`, `NOTES-PROJET.md` ou toute note de projet ;
- noms de personnes, noms de famille, lieux de vie, comptes sur des services en ligne, adresses e-mail ;
- toute information de santé, de famille, d'argent ou de vie amoureuse, y compris dans les commentaires du code, les textes d'exemple et les consignes envoyées à l'IA (écrire « la personne », jamais un prénom) ;
- clés, jetons, mots de passe.

Où mettre ces choses : dépôt **privé** `alexandralsct/carte-de-vie-donnees`, dossier `projet/` (documentation produit, notes, `maquettes/`, `pages/`, anciennes versions). Lis `projet/PRODUIT.md` là-bas pour comprendre l'app avant de la modifier.

Avant chaque commit ici, vérifier le diff : `git diff --cached --stat` ne doit lister aucune image hors des icônes de l'app, et aucun texte personnel.

## Ce qui est propre à la propriétaire

Les parties sur mesure (espaces personnels, textes, jeux, carte régionale, adresse de son système d'automatisation) ne sont **pas** dans ce code : elles vivent dans le dépôt privé (`perso/module.js`, `perso/region.js`). L'app les lit avec la clé de synchro, seulement pour un dépôt de son compte, et les exécute dans son propre contexte grâce aux points d'accroche `CROCHETS` et à `Object.assign` sur les tables. Les clés d'icônes publiques sont neutres ; le module remet les anciennes en alias.

Ne jamais remettre ici un nom d'espace, un texte ou une règle qui la concerne : l'ajouter au module privé. Le contrôle « Aucun mot de la liste privée » du garde-fou s'appuie sur le secret `MOTS_INTERDITS`.
