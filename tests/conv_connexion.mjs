/* Après la connexion (saisie à la main, puis QR), les conversations de la carte (CONV.demande : « Moi dans 5 ans », Omniscient…) partent vers
   l'adresse du serveur et avec la clé des apps rangées par l'écran Connexion. Test de bout en bout, données de démonstration neutres.
   Usage : python3 -m http.server 8767 (racine du dépôt), puis node tests/conv_connexion.mjs. Deux parties : téléphone puis ordinateur. */
const { chromium, devices } = await import(process.env.PLAYWRIGHT || 'playwright');
const URL = (process.env.URL || 'http://localhost:8767/index.html') + '?test';
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
let ko = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'KO  ') + m); if (!c) ko++; };
const K = 'cle-apps-de-demonstration-0123456789', SRV = 'https://serveur-demo.cloud';
const TEL = Object.assign({}, devices['Galaxy S9+'], { viewport: { width: 412, height: 915 } }), ORDI = { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false };
for (const [nom, profil] of [['App téléphone', TEL], ['App ordinateur', ORDI]]) {
  console.log('— ' + nom);
  const ctx = await b.newContext(Object.assign({}, profil, { serviceWorkers: 'block', locale: 'fr-FR', timezoneId: 'Europe/Paris' })), vus = [];
  await ctx.addInitScript(() => { if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1'); localStorage.clear(); ['hRap', 'compagnon', 'mouvements'].forEach(k => localStorage.setItem('test:' + k, '0')); ['compagnonChoisi', 'carte-de-vie-vu'].forEach(k => localStorage.setItem('test:' + k, '1')); });
  await ctx.route('https://api.github.com/**', r => r.abort());
  await ctx.route(/\/index\.html/, async r => { const rep = await r.fetch(); await r.fulfill({ response: rep, body: (await rep.text()).replace("connect-src 'self'", "connect-src 'self' https://serveur-demo.cloud") }); });
  await ctx.route(SRV + '/**', async r => { const q = r.request(), h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
    if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
    vus.push({ url: q.url(), cle: q.headers()['x-cle-app'] || '', corps: q.postData() || '' });
    return r.fulfill({ status: 200, headers: h, body: JSON.stringify({ ok: true, reponse: 'Bonjour' }) }); });
  const p = await ctx.newPage(), err = []; p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(URL); await p.waitForTimeout(1500);
  /* avant : pas connecté → la conversation ne part pas et le dit */
  const avant = await p.evaluate(async () => { const r = await window.__equipe.CONV.demande({ type: 'essai' }, ''); return { ok: r.ok, msg: r.msg || '' }; });
  ok(!avant.ok && vus.length === 0, nom + ' : appareil non connecté : rien ne part vers le système (' + avant.msg.slice(0, 50) + ')');
  /* saisie à la main de l'adresse et de la clé */
  await p.evaluate(() => window.__lotc.CLEF.ouvre()); await p.waitForSelector('#cleDlg #cx-champ-cle');
  await p.fill('#cx-champ-serveur', SRV); await p.fill('#cx-champ-cle', K); await p.click('#cleDlg .cx button:has-text("Enregistrer")'); await p.waitForTimeout(600);
  ok(await p.evaluate(() => window.Connexion.etat().cle) === 'cle-apps-de-demonstration-0123456789', nom + ' : l\'adresse et la clé sont rangées (rangement commun « connexion » et anciens rangements)');
  await p.reload(); await p.waitForTimeout(1500);   // au démarrage, la carte relit l'adresse du rangement commun
  const r = await p.evaluate(async () => { const x = await window.__equipe.CONV.demande({ type: 'essai', message: 'Bonjour' }, ''); return { ok: x.ok }; });
  const v = vus.find(x => /\/crochets\/app-lien$/.test(x.url));
  ok(r.ok && v && v.url === SRV + '/crochets/app-lien' && v.cle === K, nom + ' : CONV.demande part vers ' + SRV + '/crochets/app-lien avec l\'en-tête X-Cle-App (la clé saisie)');
  ok(err.length === 0, nom + ' : aucune erreur de script' + (err[0] ? ' : ' + err[0] : ''));
  await ctx.close();
}
await b.close(); console.log(ko ? '\n' + ko + ' échec(s)' : '\nTous verts.'); process.exit(ko ? 1 : 0);
