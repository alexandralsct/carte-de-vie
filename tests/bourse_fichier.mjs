/* Tests du fichier externe (news d'un espace lues à l'ouverture de l'espace, hors de la carte), avec un faux GitHub
   (aucun réseau, aucune donnée réelle), en deux parties : App téléphone puis App ordinateur.
   Usage : python3 -m http.server 8767 (à la racine du dépôt), puis node tests/bourse_fichier.mjs
   Vérifie : le fichier est lu à l'ouverture de l'espace et reste en mémoire (non énumérable) ; il n'est jamais renvoyé à la
   carte (aucun envoi ne contient son contenu) ; hors connexion, la dernière copie reste affichée. */
const { chromium, devices } = await import(process.env.PLAYWRIGHT || 'playwright');
const URL = process.env.URL || 'http://localhost:8767/index.html';
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
let ko = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'KO  ') + m); if (!c) ko++; };
const T0 = Date.now() - 3600e3;
const TITRE = 'Titre de test unique 4217';
const FICHIER = JSON.stringify({ v: 1, rub: 'bourse-t', news: [{ id: 'n1', d: '2026-11-19', score: 4, titre: TITRE, resume: 'Résumé fictif.' }],
  analyses: [], _m: T0 });
const carte = () => ({
  'espaces/bourse': { name: 'Bourse', groupe: 'Patrimoine', color: '#1E9FB8', prio: 2, x: 50, y: 50, tasks: [], ideas: [], dates: [], links: [], log: [],
    rub: [{ id: 'bourse-t', name: 'News économiques et financières', type: 'news', items: [], correlations: [], sym: 'graphique',
      ext: { f: 'bourse/news.json', n: 1, a: 0, m: T0 } }], _m: T0, _f: { name: T0, rub: T0, log: T0 } },
  'espaces/sport': { name: 'Sport', groupe: 'Corps et santé', color: '#1F8A5B', prio: 2, x: 70, y: 60, tasks: [], ideas: [], dates: [], links: [], log: [], rub: [], _m: T0 } });
/* faux dépôt : carte.json (lu et écrit), bourse/news.json (lu seulement) */
const depot = () => { const D = { carte: JSON.stringify(carte(), null, 1), puts: [], news: FICHIER, panne: false };
  return D; };
const route = D => async rt => {
  const r = rt.request(), u = new globalThis.URL(r.url()), h = r.headers();
  const json = (o, st = 200) => rt.fulfill({ status: st, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'ETag' }, body: JSON.stringify(o) });
  if (r.method() === 'OPTIONS') return rt.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,PUT' } });
  if (D.panne) return rt.abort('internetdisconnected');
  if (/\/commits$/.test(u.pathname)) return json([{ sha: 'v1', commit: { committer: { date: new Date().toISOString() } } }]);
  if (/\/contents\/bourse\/news\.json$/.test(u.pathname)) return rt.fulfill({ status: 200, contentType: 'application/vnd.github.raw', headers: { 'Access-Control-Allow-Origin': '*' }, body: D.news });
  if (/\/contents\/carte\.json$/.test(u.pathname)) {
    if (r.method() === 'PUT') { const c = JSON.parse(r.postData()); D.puts.push(Buffer.from(c.content, 'base64').toString('utf8')); return json({ content: { sha: 'v2' } }); }
    const texte = D.carte;
    if (/raw/.test(h.accept || '')) return rt.fulfill({ status: 200, contentType: 'application/vnd.github.raw', headers: { 'Access-Control-Allow-Origin': '*' }, body: texte });
    return rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'ETag', ETag: '"v1"' },
      body: JSON.stringify({ sha: 'v1', size: texte.length, encoding: 'base64', content: Buffer.from(texte).toString('base64') }) });
  }
  return json({ message: 'Not Found' }, 404);
};
const PROFILS = [['App téléphone', Object.assign({}, devices['Galaxy S9+'], { viewport: { width: 412, height: 915 } })],
  ['App ordinateur', { viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false }]];
for (const [nom, opt] of PROFILS) {
  console.log('\n== ' + nom);
  const D = depot();
  const ctx = await b.newContext(Object.assign({}, opt, { serviceWorkers: 'block', locale: 'fr-FR', timezoneId: 'Europe/Paris' }));
  await ctx.route('https://api.github.com/**', route(D));
  await ctx.addInitScript(() => { if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1'); localStorage.clear();
    localStorage.setItem('carte-de-vie-sync', JSON.stringify({ repo: 'exemple/donnees', token: 'jeton-fictif' }));
    ['hRap', 'compagnon', 'mouvements'].forEach(k => localStorage.setItem(k, '0')); localStorage.setItem('carte-de-vie-vu', '1'); });
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(URL);
  await p.waitForFunction(() => /Synchronisé/.test((document.getElementById('syncMsg') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
  const msg = await p.evaluate(() => (document.getElementById('syncMsg') || {}).textContent || '');
  ok(/Synchronisé/.test(msg), nom + ' : carte synchronisée' + (msg ? ' (' + msg + ')' : ' (message absent)'));
  ok(await p.evaluate(() => localStorage.getItem('carte-ext:bourse/news.json') === null), nom + ' : rien lu du fichier avant l\'ouverture de l\'espace');
  const ouvre = n => p.evaluate(n => { const x = [...document.querySelectorAll('.node')].find(x => (x.querySelector('b') || {}).textContent?.trim() === n); if (x) x.click(); return !!x; }, n);
  ok(await ouvre('Bourse'), nom + ' : espace Bourse ouvert');
  await p.waitForFunction(() => !!localStorage.getItem('carte-ext:bourse/news.json'), null, { timeout: 15000 }).catch(() => {});
  ok(await p.evaluate(() => (localStorage.getItem('carte-ext:bourse/news.json') || '').includes('Titre de test unique 4217')), nom + ' : fichier lu à l\'ouverture de l\'espace');
  /* une modification de l'espace Sport déclenche un envoi : aucun contenu du fichier ne doit partir vers la carte */
  await ouvre('Sport'); await p.waitForTimeout(500);
  await p.evaluate(() => { const t = document.getElementById('syncNow'); if (t) t.click(); });
  for (let i = 0; i < 20 && !D.puts.length; i++) await p.waitForTimeout(300);
  ok(D.puts.every(t => !t.includes('Titre de test unique 4217')), nom + ' : aucun envoi vers la carte ne contient le fichier');
  /* hors connexion : la dernière copie reste affichée (cache de l'appareil) */
  D.panne = true; await p.reload(); await p.waitForTimeout(800);
  ok(await p.evaluate(() => (localStorage.getItem('carte-ext:bourse/news.json') || '').includes('Titre de test unique 4217')), nom + ' : hors connexion, la dernière copie est gardée');
  ok(err.length === 0, nom + ' : aucune erreur de page' + (err.length ? ' (' + err.join(' | ') + ')' : ''));
  await ctx.close();
}
await b.close();
console.log(ko ? '\n' + ko + ' ÉCHEC(S)' : '\nSUCCÈS');
process.exit(ko ? 1 : 0);
