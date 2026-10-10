# Pour Claude : dépôt PUBLIC, code seulement

Ce dépôt est public (servi par GitHub Pages). Il ne doit contenir **que le code** de l'app : `index.html`, `sw.js`, `monde.js`, `bretagne.js`, manifestes, icônes de l'app, `tests/`, `passerelle/`, et `essai/index.html` (version d'essai de l'app, même règles).

Interdit ici, même temporairement (l'historique git est public) :
- toute capture d'écran de la vraie carte, maquette ou planche de design ;
- `PRODUIT.md`, `NOTES-PROJET.md` ou toute note de projet ;
- noms de personnes, noms de famille, lieux de vie, comptes (Pinterest, Vinted…), adresses e-mail ;
- toute information de santé, de famille, d'argent ou de vie amoureuse, y compris dans les commentaires du code, les textes d'exemple et les consignes envoyées à l'IA (écrire « la personne », jamais un prénom) ;
- clés, jetons, mots de passe.

Où mettre ces choses : dépôt **privé** `alexandralsct/carte-de-vie-donnees`, dossier `projet/` (documentation produit, notes, `maquettes/`, `pages/`, anciennes versions). Lis `projet/PRODUIT.md` là-bas pour comprendre l'app avant de la modifier.

Avant chaque commit ici, vérifier le diff : `git diff --cached --stat` ne doit lister aucune image hors des icônes de l'app, et aucun texte personnel.
