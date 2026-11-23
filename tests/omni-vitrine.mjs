// Omni : « N affichées sur M connues » et archive mensuelle du fil (20/11), en deux parties : App téléphone puis App ordinateur.
// Usage : serveur sur la racine du dépôt (python3 -m http.server 8767), puis
//   URL=http://localhost:8767/index.html node tests/omni-vitrine.mjs
// Vérifie : le compteur (fil affiché sur total connu) ; « Archive mensuelle du fil » liste les mois, ouvre un mois, revient au fil ;
// sans appareil relié au dépôt, l'archive l'explique ; aucune erreur dans la console. Données inventées, aucun appel réel (GitHub imité).
const _pw = await import(process.env.PLAYWRIGHT || 'playwright'), { chromium, devices } = _pw.chromium ? _pw : _pw.default;
const ADR = (process.env.URL || 'http://localhost:8767/index.html') + '?test';
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
let ko = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'KO  ') + m); if (!c) ko++; };
const PROFILS = [['App téléphone', 'telephone', Object.assign({}, devices['Galaxy S9+'], { viewport: { width: 412, height: 915 } })],
  ['App ordinateur', 'ordinateur', { viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false }]];
const fil = Array.from({ length: 95 }, (_, i) => ({ id: 'O-20261001-' + String(i + 1).padStart(3, '0'), date: '2026-10-01', assistant: 'LIFE', domaine: 'vie', statut: 'confirmé', contenu: 'Fait fictif n° ' + (i + 1), source: 'essai' }));
const donnees = { pause: false, total: 120, intime: 0, fil: fil.slice(0, 80), noeuds: [], liens: [], contradictions: [] };
const archive = [{ id: 'O-20260901-001', date: '2026-09-01', domaine: 'lecture', statut: 'confirmé', contenu: 'Ligne archivée fictive' }];
for (const [nom, cle, opt] of PROFILS) {
  console.log('\n== ' + nom + ' ==');
  const ctx = await b.newContext(Object.assign({}, opt, { serviceWorkers: 'block', locale: 'fr-FR', timezoneId: 'Europe/Paris', colorScheme: 'light' }));
  const reseau = { avec: true };
  await ctx.route('https://api.github.com/**', route => {
    const u = route.request().url();
    if (u.endsWith('/contents/omniscient')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ name: '2026-09.json' }, { name: '2026-10.json' }, { name: 'autre.txt' }]) });
    if (u.endsWith('/contents/omniscient/2026-09.json')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(archive) });
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
  const p = await ctx.newPage(); const erreurs = [];
  p.on('pageerror', e => erreurs.push(String(e))); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) erreurs.push(m.text()); });
  await p.goto(ADR); await p.waitForFunction(() => window.__equipe && window.__equipe.FUTUR, null, { timeout: 20000 }); await p.waitForTimeout(800);
  await p.evaluate(() => { const o = document.getElementById('onb'); if (o) o.hidden = true; });
  await p.evaluate(() => document.getElementById('iaBtn').click()); await p.waitForSelector('.choixm', { state: 'visible' });
  await p.click('.choixb >> nth=0'); await p.waitForSelector('#memPersoPage .omni', { state: 'visible' });
  await p.evaluate(d => window.__equipe.OMNI.charge(d), donnees); await p.waitForTimeout(300);
  const texte = await p.textContent('#memPersoPage .omni');
  ok(/80 affichées sur 120 connues/.test(texte), nom + " : « 80 affichées sur 120 connues » (le fil affiché sur le total connu)");
  ok(await p.locator('.omnarch').count() === 0, nom + " : l'archive n'est pas ouverte par défaut");
  await p.evaluate(() => localStorage.setItem('carte-de-vie-sync', JSON.stringify({ repo: 'essai/donnees-fictives', token: 'jeton-fictif' })));
  await p.getByRole('button', { name: 'Archive mensuelle du fil' }).click();
  await p.waitForSelector('.omnarch button', { state: 'visible', timeout: 10000 });
  const mois = await p.locator('.omnarch button').allTextContents();
  ok(mois.includes('2026-09') && mois.includes('2026-10') && !mois.some(m => /autre/.test(m)), nom + " : les mois de l'archive, sans fichier étranger (" + mois.join(', ') + ')');
  await p.getByRole('button', { name: '2026-09' }).click();
  await p.waitForSelector('.omnarch .omnifil li', { state: 'visible', timeout: 10000 });
  ok(/Ligne archivée fictive/.test(await p.textContent('.omnarch')), nom + " : un mois s'ouvre et montre ses lignes");
  ok(await p.getByRole('button', { name: '← Les mois' }).count() === 1, nom + ' : bouton « Les mois » présent');
  await p.getByRole('button', { name: 'Revenir au fil' }).click();
  ok(await p.locator('.omnarch').count() === 0 && /affichées sur 120 connues/.test(await p.textContent('#memPersoPage .omni')), nom + ' : « Revenir au fil » ramène le fil et son compteur');
  ok(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1, nom + ' : pas de défilement horizontal');
  // sans appareil relié
  await p.evaluate(() => localStorage.removeItem('carte-de-vie-sync'));
  await p.getByRole('button', { name: 'Archive mensuelle du fil' }).click();
  ok(/relié à ton dépôt/.test(await p.textContent('.omnarch')), nom + " : sans appareil relié, l'archive l'explique");
  ok(erreurs.length === 0, nom + ' : aucune erreur dans la console' + (erreurs.length ? ' : ' + erreurs.slice(0, 3).join(' | ') : ''));
  await ctx.close();
}
await b.close();
console.log(ko ? '\n' + ko + ' échec(s)' : '\nTout est vert');
process.exit(ko ? 1 : 0);
