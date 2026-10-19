/* Connecter un téléphone par QR, le même parcours que dans LIFE (v232) : l'appareil déjà relié affiche le QR (Réglages → Connexion → « Connecter un
   autre appareil ») ; l'appareil neuf l'ouvre avec l'appareil photo : la carte demande de confirmer le serveur, retire le paquet chiffré, enregistre les deux
   clés (clé des apps, jeton de synchro) puis dit « Appareil connecté ✓ ». Un QR ne sert qu'une fois ; un lien ne remplace jamais le serveur d'un appareil déjà relié.
   Données de démonstration neutres, serveur simulé. Usage : python3 -m http.server 8767 (racine du dépôt), puis node tests/appairage.mjs.
   Deux parties : « App téléphone » (412 px, tactile) puis « App ordinateur » (1280 px, souris). */
const { chromium, devices } = await import(process.env.PLAYWRIGHT || 'playwright');
const URL = process.env.URL || 'http://localhost:8767/index.html';
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
let ko = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'KO  ') + m); if (!c) ko++; };
const K = 'cle-apps-de-demonstration-0123456789', J = 'jeton-de-demonstration-0123456789', PIL = 'cle-pilote-de-demonstration-0123456789', SRV = 'https://serveur-demo.cloud';
const TEL = Object.assign({}, devices['Galaxy S9+'], { viewport: { width: 412, height: 915 } }), ORDI = { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false };
const CARTE = JSON.stringify({ 'espaces/demo': { name: 'Espace de démo', groupe: 'Vie perso', color: '#3E95C9', prio: 2, x: 30, y: 30, rub: [{ id: 'a1', name: 'Un', items: [{ id: 'i1', text: 'a', done: false }] }], tasks: [], ideas: [], dates: [], links: [], log: [], _m: Date.now() } });
const ANCIEN = { 'carte-de-vie-lien': K, 'carte-de-vie-sync': JSON.stringify({ repo: 'compte-demo/depot-demo', token: J }), 'coulisses-pilote': JSON.stringify({ adresse: SRV, cle: PIL }), 'coulisses-config': JSON.stringify({ depot: 'compte-demo/etat-demo', jeton: J + 'x' }) };
const paquets = {};
async function contexte(profil, init) {
  const ctx = await b.newContext(Object.assign({}, profil, { serviceWorkers: 'block', locale: 'fr-FR', timezoneId: 'Europe/Paris' }));
  await ctx.addInitScript(([carte, init]) => { if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1'); localStorage.clear(); localStorage.setItem('carte-de-vie-v1', carte);
    ['hRap', 'compagnon', 'mouvements'].forEach(k => localStorage.setItem(k, '0')); ['compagnonChoisi'].forEach(k => localStorage.setItem(k, '1'));
    localStorage.setItem('carte-de-vie-passerelle', JSON.stringify({ url: 'https://serveur-demo.cloud/crochets/app-lien' })); for (const k in init) localStorage.setItem(k, init[k]); }, [CARTE, init]);
  await ctx.route('https://api.github.com/**', r => r.abort());
  await ctx.route(/\/index\.html/, async r => { const rep = await r.fetch(); await r.fulfill({ response: rep, body: (await rep.text()).replace("connect-src 'self'", "connect-src 'self' https://serveur-demo.cloud") }); });
  await ctx.route(SRV + '/**', async r => { const q = r.request(), c = JSON.parse(q.postData() || '{}'), h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' }, u = q.url();
    if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
    if (u.endsWith('/app-lien-transfert')) { const d = paquets[c.id]; delete paquets[c.id]; return r.fulfill({ status: d ? 200 : 404, headers: h, body: JSON.stringify(d ? { ok: true, donnees: d } : { ok: false }) }); }
    if (u.endsWith('/app-lien')) { if (q.headers()['x-cle-app'] !== K) return r.fulfill({ status: 403, headers: h, body: '{"ok":false}' });
      if (c.type === 'transfert_deposer') { paquets[c.id] = c.donnees; return r.fulfill({ status: 200, headers: h, body: '{"ok":true,"transfert":true,"expire":1}' }); }
      return r.fulfill({ status: 200, headers: h, body: '{"ok":true}' }); }
    return r.abort(); });
  return ctx;
}
const lit = p => p.evaluate(() => ({ lien: localStorage.getItem('carte-de-vie-lien'), life: JSON.parse(localStorage.getItem('life.cle') || '""'), pi: JSON.parse(localStorage.getItem('coulisses-pilote') || 'null'), cc: JSON.parse(localStorage.getItem('coulisses-config') || 'null'), repo: document.getElementById('syncRepo').value, tok: document.getElementById('syncToken').value, hash: location.hash }));
for (const [nom, profil] of [['App téléphone', TEL], ['App ordinateur', ORDI]]) {
  console.log('— ' + nom);
  /* 1. appareil déjà relié : le QR s'affiche */
  const c1 = await contexte(profil, ANCIEN), p = await c1.newPage(), err = []; p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(URL); await p.waitForTimeout(1500);
  await p.click('.top3a button[aria-label="Réglages"]'); await p.waitForTimeout(400);
  await p.click('#cxBtn'); await p.waitForSelector('#cleDlg .cx .cx-bloc button');
  ok(/Jeton de synchro GitHub/.test(await p.textContent('#cleDlg .cx')) && /Clé des apps/.test(await p.textContent('#cleDlg .cx')), nom + ' : l\'écran Connexion sépare clairement le jeton de synchro (GitHub) et la clé des apps');
  await p.click('#cleDlg .cx button:has-text("Générer un QR")'); await p.waitForSelector('#cleDlg .cx-qr', { timeout: 8000 });
  await p.waitForFunction(() => /Vise ce QR avec l'appareil photo.*une seule fois/.test((document.querySelector('#cleDlg .cx-plus') || {}).textContent || ''), null, { timeout: 8000 });
  ok(await p.$eval('#cleDlg .cx-qr', i => /^data:image\/svg\+xml/.test(i.src)), nom + ' : l\'ordinateur affiche le QR et dit « vise-le avec l\'appareil photo, une seule fois »');
  const lien = await p.evaluate(() => Connexion.deposer({ carteUrl: location.href.split('#')[0] }));   // le lien que porte le QR, tel que l'appareil photo l'ouvre
  ok(/#transfert=/.test(lien) && !lien.includes(K) && !lien.includes(J), nom + ' : le QR ne porte ni la clé ni le jeton');
  /* 2. appareil neuf : l'appareil photo ouvre le lien */
  const c2 = await contexte(profil, {}), q = await c2.newPage(); q.on('pageerror', e => err.push(e.message));
  await q.goto(lien); await q.waitForSelector('#cxRecoit[open]', { timeout: 8000 });
  const t = await q.textContent('#cxRecoit');
  ok(/Connecter cet appareil \?/.test(t) && /Ce lien relie la carte au serveur/.test(t) && await q.$eval('#cxRecoit .mono', e => e.textContent) === 'serveur-demo.cloud', nom + ' : le téléphone demande « Connecter cet appareil ? » et montre le serveur');
  ok(/Deux clés différentes/.test(t) && /ne remplace jamais l'autre/.test(t), nom + ' : la boîte sépare le jeton de synchro et la clé des apps');
  ok((await lit(q)).hash === '' && (await lit(q)).lien === null, nom + ' : rien n\'est encore enregistré (le lien est effacé de la barre d\'adresse)');
  ok(await q.$eval('#cxRecoitOk', e => e.disabled), nom + ' : « Connecter » est grisé tant que le nom du serveur n\'est pas retapé');
  await q.fill('#cxRecoitSaisie', 'autre-serveur.cloud'); ok(await q.$eval('#cxRecoitOk', e => e.disabled), nom + ' : un mauvais nom ne suffit pas');
  await q.fill('#cxRecoitSaisie', 'serveur-demo.cloud'); ok(!(await q.$eval('#cxRecoitOk', e => e.disabled)), nom + ' : le bon nom active « Connecter »');
  await q.click('#cxRecoitOk'); await q.waitForFunction(() => /Appareil connecté ✓/.test((document.getElementById('cxRecoit') || {}).textContent || ''), null, { timeout: 10000 });
  const n = await lit(q);
  ok(n.lien === K && n.life === K && n.pi && n.pi.cle === PIL && n.cc && n.cc.depot === 'compte-demo/etat-demo', nom + ' : « Appareil connecté ✓ » : clé des apps (carte et LIFE), pilotage et lecture de Coulisses enregistrés');
  ok(n.repo === 'compte-demo/depot-demo' && n.tok === J, nom + ' : le jeton GitHub de synchro est transmis à part et remplit la liaison de la carte');
  ok(/Connectées sur cet appareil : Ma carte de vie, LIFE, Coulisses/.test(await q.textContent('#cxRecoit')) && !(await q.textContent('#cxRecoit')).includes(K) && !(await q.textContent('#cxRecoit')).includes(J), nom + ' : le message final liste ce qui marche, sans montrer aucun secret');
  await q.screenshot({ path: '/tmp/appairage-' + (profil === TEL ? 'tel' : 'ordi') + '.png' });
  /* 3. le même QR ne sert qu'une fois */
  const c3 = await contexte(profil, {}), r = await c3.newPage(); await r.goto(lien); await r.waitForSelector('#cxRecoit[open]'); await r.fill('#cxRecoitSaisie', 'serveur-demo.cloud'); await r.click('#cxRecoitOk');
  await r.waitForFunction(() => /Connexion impossible/.test((document.getElementById('cxRecoit') || {}).textContent || ''), null, { timeout: 10000 });
  ok(/déjà servi/.test(await r.textContent('#cxRecoit')) && (await lit(r)).lien === null, nom + ' : le même QR, relu, est refusé (« déjà servi ») et ne change rien');
  /* 4. appareil déjà relié au même serveur : un seul toucher ; à un autre serveur : refus */
  const l2 = await p.evaluate(() => Connexion.deposer({ carteUrl: location.href.split('#')[0] }));
  const c4 = await contexte(profil, { 'carte-de-vie-lien': K }), s = await c4.newPage(); await s.goto(URL); await s.waitForTimeout(800);
  await s.evaluate(async () => { await CLEF.charge(); Connexion.appliquer({ serveur: 'https://serveur-demo.cloud', cle: 'cle-apps-de-demonstration-0123456789' }); }); await s.evaluate(l => { location.hash = l.split('#')[1]; }, l2);
  await s.waitForSelector('#cxRecoit[open]', { timeout: 8000 });
  ok(!(await s.$eval('#cxRecoitOk', e => e.disabled)) && !(await s.$('#cxRecoitSaisie')) && /serveur déjà enregistré/.test(await s.textContent('#cxRecoit')), nom + ' : appareil déjà relié au même serveur : un seul toucher, sans retaper le nom');
  await s.click('#cxRecoitNon'); ok(/Rien n'a changé/.test(await s.textContent('#cxRecoit')), nom + ' : « Refuser » dit que rien n\'a changé');
  const l3 = await p.evaluate(() => Connexion.deposer({ carteUrl: location.href.split('#')[0] }));
  const c5 = await contexte(profil, {}), u = await c5.newPage(); await u.goto(URL); await u.waitForTimeout(800);
  await u.evaluate(async () => { await CLEF.charge(); Connexion.appliquer({ serveur: 'https://autre-serveur.cloud', cle: 'une-autre-cle-de-demonstration-123456' }); }); await u.evaluate(l => { location.hash = l.split('#')[1]; }, l3);
  await u.waitForSelector('#cxRecoit[open]', { timeout: 8000 });
  ok(/Lien refusé/.test(await u.textContent('#cxRecoit')) && !(await u.$('#cxRecoitOk')) && (await u.evaluate(() => Connexion.etat().serveur)) === 'https://autre-serveur.cloud', nom + ' : appareil déjà relié à un autre serveur : « Lien refusé », pas de bouton Connecter, rien ne change');
  ok(err.length === 0, nom + ' : aucune erreur de script' + (err.length ? ' : ' + err[0] : ''));
  for (const c of [c1, c2, c3, c4, c5]) await c.close();
}
await b.close(); console.log(ko ? '\n' + ko + ' échec(s)' : '\nTous verts.'); process.exit(ko ? 1 : 0);
