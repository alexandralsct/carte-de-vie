/* Test des boutons Oui / Non sur « Document à valider » (cockpit, page de détail), sur des données de démonstration neutres.
   Le serveur est lu dans la règle de sécurité de la page ; toute requête qui lui est adressée est interceptée par le test.
   Usage : python3 -m http.server 8767 (racine du dépôt), puis node tests/documents.mjs. Le serveur est simulé (aucun appel réel).
   Deux parties : « App téléphone » (412 px, tactile) puis « App ordinateur » (1280 px, souris). */
const { chromium, devices } = await import(process.env.PLAYWRIGHT || 'playwright');
const ADRESSE_PAGE = (process.env.URL || 'http://localhost:8767/index.html'), URL = ADRESSE_PAGE + '?test';
/* le serveur simulé est lu dans la règle de sécurité de la page (seule adresse autorisée à part GitHub et Google) : aucune adresse écrite ici */
const csp = (await (await fetch(ADRESSE_PAGE)).text()).match(/connect-src([^;"]*)/)[1].split(/\s+/).filter(h => /^https:\/\/[a-z0-9.-]+$/.test(h) && !/github|google/.test(h));
const SERVEUR = csp[0], ADRESSE = SERVEUR + '/crochets/app-lien';
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
let ko = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'KO  ') + m); if (!c) ko++; };
const DOC = { type: 'DOCUMENT_A_VALIDER', source: 'PORTFOLIO', objet: 'Document de démonstration', quand: '2026-10-19 07:30',
  detail: 'Un document de démonstration (ligne DOC-portfolio-OFF-7, version 2) attend ta décision.' };
const SANS_ID = Object.assign({}, DOC, { objet: 'Sans identifiant', detail: 'Rien à lire ici.' });
const AUTRE = Object.assign({}, DOC, { type: 'ALERTE', objet: 'Autre type' });
const TEL = Object.assign({}, devices['Galaxy S9+'], { viewport: { width: 412, height: 915 } }), ORDI = { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false };
for (const [nom, profil] of [['App téléphone', TEL], ['App ordinateur', ORDI]]) {
  console.log('— ' + nom);
  const ctx = await b.newContext(Object.assign({}, profil, { serviceWorkers: 'block', locale: 'fr-FR', timezoneId: 'Europe/Paris' }));
  await ctx.addInitScript(([serveur]) => { if (!sessionStorage.getItem('init')) { sessionStorage.setItem('init', '1'); localStorage.clear();
    ['hRap', 'compagnon', 'mouvements'].forEach(k => localStorage.setItem('test:' + k, '0')); ['compagnonChoisi', 'carte-de-vie-vu'].forEach(k => localStorage.setItem('test:' + k, '1'));
    localStorage.setItem('test:carte-de-vie-lien', 'cle-de-demo'); localStorage.setItem('test:connexion', JSON.stringify({ serveur })); } }, [SERVEUR]);
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
  const recu = []; let mode = 'ok';
  await p.route(ADRESSE, async r => { const q = r.request(); recu.push({ cle: q.headers()['x-cle-app'], corps: q.postDataJSON() });
    if (mode === 'reseau') return r.abort('failed');
    if (mode === 'refus') return r.fulfill({ status: 403, contentType: 'application/json', body: '{}' });
    if (mode === 'deja') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: false, type: 'document', reponse: 'Déjà enregistré.', document: null }) });
    if (mode === 'html') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, type: 'document', reponse: '<b id="piege">Gras</b> noté', document: { id: 'DOC-portfolio-OFF-7', statut: 'accepte' } }) });
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, type: 'document', reponse: 'Document accepté.', document: { id: 'DOC-portfolio-OFF-7', statut: 'accepte' } }) }); });
  await p.goto(URL); await p.waitForTimeout(1500);
  const ouvre = e => p.evaluate(e => { window.__docv.ouvrirDetail(e); }, e), masques = () => p.evaluate(() => window.__docv.masques());
  /* présence des boutons */
  await ouvre(AUTRE); ok(await p.locator('#ckDet .docv').count() === 0, nom + ' : pas de boutons sur un autre type d\'élément');
  await ouvre(SANS_ID); ok(await p.locator('#ckDet .docv').count() === 0 && await p.locator('#ckDet').isVisible(), nom + ' : sans identifiant DOC-…, pas de boutons (l\'élément reste consultable)');
  await ouvre(DOC); ok(await p.locator('#ckDet .docvoui').count() === 1 && await p.locator('#ckDet .docvnon').count() === 1, nom + ' : Oui et Non sur le document à valider');
  /* mise en page propre à chaque app */
  const g = await p.evaluate(() => { const o = document.querySelector('#ckDet .docvoui').getBoundingClientRect(), n = document.querySelector('#ckDet .docvnon').getBoundingClientRect();
    return { ho: o.height, wo: o.width, wn: n.width, memeLigne: Math.abs(o.top - n.top) < 4, display: getComputedStyle(document.querySelector('#ckDet .docvbtns')).display }; });
  if (profil === TEL) ok(g.ho >= 48 && g.wo > 140 && g.memeLigne && g.display === 'grid', nom + ' : grands boutons tactiles côte à côte (' + JSON.stringify(g) + ')');
  else ok(g.ho <= 44 && g.wo < 160 && g.display === 'flex', nom + ' : boutons compacts à la souris (' + JSON.stringify(g) + ')');
  /* confirmation puis annulation : rien n'est envoyé */
  await p.locator('#ckDet .docvoui').click(); ok(/enregistré dans ton Drive/.test(await p.locator('#ckDet .docvmsg').textContent()), nom + ' : « Oui » demande confirmation (document enregistré dans le Drive)');
  await p.locator('#ckDet .docvann').click(); ok(recu.length === 0 && await p.locator('#ckDet .docvoui').count() === 1, nom + ' : « Annuler » revient, rien n\'est envoyé');
  await p.locator('#ckDet .docvnon').click(); ok(/refusé/.test(await p.locator('#ckDet .docvmsg').textContent()), nom + ' : « Non » demande aussi confirmation');
  await p.locator('#ckDet .docvann').click();
  /* échecs : message clair, rien n'est retiré */
  for (const [m, motif, quoi] of [['reseau', /n'a pas répondu.*Rien n'a été retiré/, 'serveur injoignable'], ['refus', /plus connecté.*Rien n'a été retiré/, 'clé refusée'], ['deja', /Déjà enregistré.*Rien n'a été retiré/, 'ok:false']]) {
    mode = m; await p.locator('#ckDet .docvoui').click(); await p.locator('#ckDet .docvgo').click(); await p.waitForTimeout(400);
    ok(motif.test(await p.locator('#ckDet .docvmsg').textContent()) && (await masques()).length === 0 && await p.locator('#ckDet .docvoui').count() === 1, nom + ' : ' + quoi + ' → message clair, élément conservé, boutons de nouveau disponibles'); }
  /* succès : message exact, puis retrait de « à relire » seulement après ok:true */
  mode = 'ok'; recu.length = 0; await p.locator('#ckDet .docvoui').click(); await p.locator('#ckDet .docvgo').click(); await p.waitForTimeout(400);
  ok(recu.length === 1 && recu[0].cle === 'cle-de-demo' && JSON.stringify(recu[0].corps) === JSON.stringify({ type: 'document', document: { id: 'DOC-portfolio-OFF-7', decision: 'oui' },
    element: { type: 'DOCUMENT_A_VALIDER', source: 'PORTFOLIO', objet: 'Document de démonstration' } }), nom + ' : message exact vers le lien (type, document.id, decision, element) avec l\'en-tête X-Cle-App (' + JSON.stringify(recu[0] && recu[0].corps) + ')');
  ok(await p.locator('#ckDet .docvmsg').textContent() === 'Document accepté.' && await p.locator('#ckDet .docvbtns button').count() === 0, nom + ' : ok:true → la réponse du système est affichée, les boutons disparaissent');
  ok((await masques()).length === 1, nom + ' : ok:true → l\'élément est retiré de « à relire »');
  /* « Non » : decision non ; texte reçu affiché sans interprétation */
  mode = 'html'; recu.length = 0; await ouvre(Object.assign({}, DOC, { objet: 'Second document' })); await p.locator('#ckDet .docvnon').click(); await p.locator('#ckDet .docvgo').click(); await p.waitForTimeout(400);
  ok(recu.length === 1 && recu[0].corps.document.decision === 'non', nom + ' : « Non » envoie decision = non');
  ok(await p.locator('#ckDet #piege').count() === 0 && /<b id="piege">Gras<\/b> noté/.test(await p.locator('#ckDet .docvmsg').textContent()), nom + ' : texte reçu affiché en texte (textContent), jamais en HTML');
  ok(err.length === 0, nom + ' : aucune erreur de page' + (err.length ? ' (' + err[0] + ')' : ''));
  await ctx.close();
}
/* aucune adresse de serveur dans le code public */
const page = await (await fetch(URL.replace('?test', ''))).text();
ok(!/cle-de-demo/.test(page), 'Code public : aucune adresse de serveur ni clé ajoutée par les boutons');
await b.close(); console.log(ko ? ko + ' échec(s)' : 'Tout est vert'); process.exit(ko ? 1 : 0);
