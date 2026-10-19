/* L'écran « Connexion » de la carte est le même que celui de LIFE (19/10) : même fichier connexion.js, même feuille (à une ligne
   près, propre à la carte), et, sur le même état de démonstration, exactement le même contenu (textes, boutons, lignes, QR, message
   d'erreur). Ce qui change d'une app à l'autre : la police et les couleurs (charte de chaque app) et ce qui entoure l'écran.
   Il faut le dépôt de LIFE (public, lecture seule) : LIFE_DIR=<dossier de LIFE> et LIFE_URL=http://localhost:8768/index.html
   (python3 -m http.server 8768 dans ce dossier). Sans LIFE_DIR : test signalé « IGNORÉ » (code 0), à ne pas compter comme vert.
   Usage : python3 -m http.server 8767 (racine du dépôt), puis node tests/connexion-life.mjs.
   Deux parties : « App téléphone » (412 px) puis « App ordinateur » (1280 px). */
import fs from 'node:fs';
const LIFE_DIR = process.env.LIFE_DIR;
if (!LIFE_DIR || !fs.existsSync(LIFE_DIR + '/connexion.js')) { console.log('IGNORÉ : dépôt de LIFE absent (LIFE_DIR). Ce test n\'a pas été exécuté.'); process.exit(0); }
const { chromium, devices } = await import(process.env.PLAYWRIGHT || 'playwright');
const CARTE_URL = process.env.URL || 'http://localhost:8767/index.html', LIFE_URL = process.env.LIFE_URL || 'http://localhost:8768/index.html';
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
let ko = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'KO  ') + m); if (!c) ko++; };
const K = 'cle-apps-de-demonstration-0123456789', SRV = 'https://serveur-demo.cloud';
const TEL = Object.assign({}, devices['Galaxy S9+'], { viewport: { width: 412, height: 915 } }), ORDI = { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false };
ok(fs.readFileSync('connexion.js', 'utf8') === fs.readFileSync(LIFE_DIR + '/connexion.js', 'utf8'), 'connexion.js : le même fichier que dans LIFE, à l\'octet près');
ok(fs.readFileSync('connexion.css', 'utf8') === fs.readFileSync(LIFE_DIR + '/connexion.css', 'utf8'), 'connexion.css : le même fichier que dans LIFE, à l\'octet près');
async function ecran(profil, app) {
  const ctx = await b.newContext(Object.assign({}, profil, { serviceWorkers: 'block', locale: 'fr-FR', timezoneId: 'Europe/Paris' }));
  await ctx.addInitScript(([K, SRV]) => { if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1'); localStorage.clear();
    ['hRap', 'compagnon', 'mouvements'].forEach(k => localStorage.setItem(k, '0')); ['compagnonChoisi', 'carte-de-vie-vu'].forEach(k => localStorage.setItem(k, '1'));
    localStorage.setItem('connexion', JSON.stringify({ serveur: SRV, cle: K })); localStorage.setItem('life.cle', JSON.stringify(K)); localStorage.setItem('life.adresse', JSON.stringify(SRV + '/crochets/life')); }, [K, SRV]);
  await ctx.route('https://**/*', r => r.abort());
  const p = await ctx.newPage(), err = []; p.on('pageerror', e => err.push(e.message));
  let sel;
  if (app === 'carte') { await p.goto(CARTE_URL); await p.waitForTimeout(1500); await p.evaluate(() => CLEF.ouvre()); sel = '#cleDlg .cx'; }
  else { await p.goto(LIFE_URL); await p.waitForTimeout(1500); await p.evaluate(() => ouvrirReglages()); sel = '#connexion-ecran.cx, #connexion-ecran .cx'; }
  await p.waitForSelector(sel, { timeout: 8000 }); await p.waitForTimeout(500);
  /* le filet de lisibilité de la carte (le soir, thème sombre) peut poser un attribut data-lis et une couleur en ligne sur un bouton : ce n'est pas du contenu */
  const r = await p.$eval(sel, e => ({ html: e.innerHTML.replace(/Connexion · (Ma carte de vie|LIFE|Coulisses)/, 'Connexion · NOM').replace(/ data-lis="1"/g, '').replace(/ style="color: [^"]*!important;"/g, ''), texte: e.innerText, boutons: [...e.querySelectorAll('button')].map(x => x.textContent), lignes: [...e.querySelectorAll('.cx-lien')].map(x => x.textContent), h: Math.round(e.getBoundingClientRect().width), ok: e.getBoundingClientRect().height > 0 }));
  /* même message d'erreur : le texte commun, et ce que chaque app affiche pour « pas connecté » */
  r.erreur = await p.evaluate(() => window.Connexion && window.Connexion.ERREUR); r.err = err;
  await ctx.close(); return r;
}
for (const [nom, profil] of [['App téléphone', TEL], ['App ordinateur', ORDI]]) {
  console.log('— ' + nom);
  const c = await ecran(profil, 'carte'), v = await ecran(profil, 'life');
  ok(c.ok && v.ok, nom + ' : les deux écrans s\'affichent');
  { let i = 0; while (i < c.html.length && c.html[i] === v.html[i]) i++;
    ok(c.html === v.html, nom + ' : même contenu, mêmes textes et mêmes boutons (HTML identique, ' + c.html.length + ' car.)' + (c.html === v.html ? '' : ' — premier écart : carte « ' + c.html.slice(i, i + 80) + ' » / LIFE « ' + v.html.slice(i, i + 80) + ' »')); }
  ok(c.boutons.join('|') === v.boutons.join('|') && c.boutons.join('|') === 'Générer un QR|Enregistrer', nom + ' : mêmes boutons : ' + c.boutons.join(' · '));
  ok(c.erreur && c.erreur === v.erreur, nom + ' : même message d\'erreur : « ' + c.erreur + ' »');
  ok(c.err.length === 0 && v.err.length === 0, nom + ' : aucune erreur de script');
}
await b.close(); console.log(ko ? '\n' + ko + ' échec(s)' : '\nTous verts.'); process.exit(ko ? 1 : 0);
