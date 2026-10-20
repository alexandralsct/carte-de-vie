// Choix de la bulle Omni (20/10), dans le navigateur, en deux parties : App téléphone puis App ordinateur.
// Usage : serveur sur la racine du dépôt (python3 -m http.server 8767 (racine du dépôt)), puis
//   PLAYWRIGHT=… CHROMIUM=… URL=http://localhost:8767/index.html OUT=dossier-des-captures node tests/choix-omni.mjs
// Vérifie : la bulle ◎ ouvre un choix à deux entrées (rôle dialog, aria-label) ; « Omniscient » ouvre la page Omni, « Moi dans 5 ans » ouvre la page Moi dans 5 ans ;
// Échap et « Fermer » ramènent à la bulle (focus rendu) ; toucher à côté ferme ; feuille en bas sur téléphone, menu près de la bulle sur ordinateur ;
// pas de défilement horizontal ; aucune erreur dans la console. Données inventées.
import fs from 'fs';
import path from 'path';
const _pw = await import(process.env.PLAYWRIGHT || 'playwright'), { chromium, devices } = _pw.chromium ? _pw : _pw.default;
const ADR = (process.env.URL || 'http://localhost:8767/index.html') + '?test';
const OUT = process.env.OUT || '';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
let ko = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'KO  ') + m); if (!c) ko++; };
const PROFILS = [['App téléphone', 'telephone', Object.assign({}, devices['Galaxy S9+'], { viewport: { width: 412, height: 915 } })],
  ['App ordinateur', 'ordinateur', { viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false }]];
for (const [nom, cle, opt] of PROFILS) {
  console.log('\n== ' + nom + ' ==');
  const ctx = await b.newContext(Object.assign({}, opt, { serviceWorkers: 'block', locale: 'fr-FR', timezoneId: 'Europe/Paris', colorScheme: 'light' }));
  const p = await ctx.newPage(); const erreurs = []; p.on('pageerror', e => erreurs.push(String(e))); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) erreurs.push(m.text()); });
  await p.goto(ADR); await p.waitForFunction(() => window.__equipe && window.__equipe.FUTUR, null, { timeout: 20000 }); await p.waitForTimeout(1500);
  await p.evaluate(() => { const o = document.getElementById('onb'); if (o) o.hidden = true; });
  const ouvert = id => p.evaluate(id => { const e = document.getElementById(id); return !!e && !e.hidden; }, id);
  const ouvreChoix = async () => { await p.evaluate(() => document.getElementById('iaBtn').click()); await p.waitForSelector('.choixm', { state: 'visible' }); };
  /* le choix s'ouvre avec deux entrées nommées */
  await ouvreChoix();
  ok(await p.getAttribute('.choixm', 'role') === 'dialog' && /Omni/.test(await p.getAttribute('.choixm', 'aria-label')), nom + ' : le choix est un dialogue nommé « Omni »');
  ok(await p.locator('.choixb').count() === 2, nom + ' : deux entrées');
  ok(/Omniscient/.test(await p.getAttribute('.choixb >> nth=0', 'aria-label')) && /Moi dans 5 ans/.test(await p.getAttribute('.choixb >> nth=1', 'aria-label')), nom + ' : Omniscient et Moi dans 5 ans, avec aria-label');
  ok(await p.locator('.choixb svg').count() === 2, nom + ' : chaque entrée a son icône');
  ok(!(await ouvert('memPersoPage')) && !(await ouvert('futurPage')), nom + ' : aucune page ne s\'est ouverte avant le choix');
  const r = await p.evaluate(() => { const m = document.querySelector('.choixm').getBoundingClientRect(), t = document.getElementById('iaBtn').getBoundingClientRect(); return { m: [m.left, m.top, m.width, m.height], t: [t.left, t.top, t.width, t.height], H: innerHeight, W: innerWidth }; });
  if (cle === 'telephone') ok(r.m[2] >= r.W - 2 && Math.abs(r.m[1] + r.m[3] - r.H) <= 2, nom + ' : feuille pleine largeur collée en bas');
  else ok(r.m[2] <= 320 && r.m[0] >= 0 && r.m[1] >= 0 && Math.abs(r.m[0] + r.m[2] - (r.t[0] + r.t[2])) <= 40, nom + ' : petit menu près de la bulle');
  ok(await p.evaluate(() => document.activeElement.classList.contains('choixb')), nom + ' : le focus est dans le choix');
  ok(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1, nom + ' : pas de défilement horizontal');
  if (OUT) await p.screenshot({ path: path.join(OUT, `${cle}-choix-omni.png`) });
  /* Échap ferme et rend la main à la bulle */
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  ok(await p.locator('.choixm').count() === 0, nom + ' : Échap ferme le choix');
  ok(await p.evaluate(() => document.activeElement && document.activeElement.id) === 'iaBtn', nom + ' : le focus revient sur la bulle');
  /* « Fermer » et toucher à côté */
  await ouvreChoix(); await p.click('.choixx'); ok(await p.locator('.choixm').count() === 0, nom + ' : « Fermer » ferme le choix');
  await ouvreChoix(); await p.mouse.click(5, 5); await p.waitForTimeout(150); ok(await p.locator('.choixm').count() === 0, nom + ' : toucher à côté ferme le choix');
  ok(!(await ouvert('memPersoPage')) && !(await ouvert('futurPage')), nom + ' : fermer le choix n\'ouvre rien');
  /* Omniscient → page Omni */
  await ouvreChoix(); await p.click('.choixb >> nth=0'); await p.waitForSelector('#memPersoPage .omni', { state: 'visible' });
  ok(await p.locator('.choixm').count() === 0 && await ouvert('memPersoPage') && !(await ouvert('futurPage')), nom + ' : « Omniscient » ouvre la page Omni');
  ok(/Omni/.test(await p.textContent('#memPersoPage h2')), nom + ' : la page s\'appelle « Omni »');
  await p.evaluate(() => { document.getElementById('memPersoPage').hidden = true; });
  /* Moi dans 5 ans → page Moi dans 5 ans */
  await ouvreChoix(); await p.click('.choixb >> nth=1'); await p.waitForSelector('#futurPage .futtete', { state: 'visible' });
  ok(await p.locator('.choixm').count() === 0 && await ouvert('futurPage'), nom + ' : « Moi dans 5 ans » ouvre la page Moi dans 5 ans');
  ok(erreurs.length === 0, nom + ' : aucune erreur dans la console' + (erreurs.length ? ' : ' + erreurs.slice(0, 3).join(' | ') : ''));
  await ctx.close();
}
await b.close();
console.log(ko ? '\n' + ko + ' échec(s)' : '\nTout est vert');
process.exit(ko ? 1 : 0);
