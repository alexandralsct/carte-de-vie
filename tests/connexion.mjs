/* Écran « Connexion » de Ma carte de vie (19/10) sur données de démonstration neutres : une ligne par lien, rien perdu sur un appareil déjà connecté,
   QR à usage unique reçu sur un appareil neuf (code entier), synchro liée par le bouton de la carte, message unique, mise en page.
   Usage : python3 -m http.server 8767 (racine du dépôt), puis node tests/connexion.mjs.
   Deux parties : « App téléphone » (412 px, tactile) puis « App ordinateur » (1280 px, souris). */
const { chromium, devices } = await import(process.env.PLAYWRIGHT || 'playwright');
const URL = process.env.URL || 'http://localhost:8767/index.html';
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
let ko = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'KO  ') + m); if (!c) ko++; };
const K = 'cle-apps-de-demonstration-0123456789', J = 'jeton-de-demonstration-0123456789', PIL = 'cle-pilote-de-demonstration-0123456789', SRV = 'https://serveur-demo.cloud';
const TEL = Object.assign({}, devices['Galaxy S9+'], { viewport: { width: 412, height: 915 } }), ORDI = { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false };
const CARTE = JSON.stringify({ 'espaces/demo': { name: 'Espace de démo', groupe: 'Vie perso', color: '#3E95C9', prio: 2, x: 30, y: 30, rub: [{ id: 'a1', name: 'Un', items: [{ id: 'i1', text: 'a', done: false }] }], tasks: [], ideas: [], dates: [], links: [], log: [], _m: Date.now() } });
/* bouton « Connexion » de la page Synchronisation (Réglages) ; le raccourci du menu latéral (réservé au propriétaire) est vérifié dans le code */
const ouvreCx = async pg => { await pg.evaluate(() => { document.getElementById('syncPage').hidden = false; document.getElementById('syncForm').hidden = false; }); await pg.click('#syncPage button:has-text("Connexion : code")'); };
const paquets = {}; let cleVue = '';
async function contexte(profil, init) {
  const ctx = await b.newContext(Object.assign({}, profil, { serviceWorkers: 'block', locale: 'fr-FR', timezoneId: 'Europe/Paris' }));
  await ctx.addInitScript(([carte, init]) => { if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1'); localStorage.clear(); localStorage.setItem('carte-de-vie-v1', carte);
    ['hRap', 'compagnon', 'mouvements'].forEach(k => localStorage.setItem(k, '0')); ['compagnonChoisi', 'carte-de-vie-vu'].forEach(k => localStorage.setItem(k, '1'));
    localStorage.setItem('carte-de-vie-passerelle', JSON.stringify({ url: 'https://serveur-demo.cloud/crochets/app-lien' })); for (const k in init) localStorage.setItem(k, init[k]); }, [CARTE, init]);
  await ctx.route('https://api.github.com/**', r => r.abort());
  await ctx.route(/api\.github\.com\/repos\/compte-demo\/depot-demo$/, r => r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' }, body: '{}' }));
  await ctx.route(/\/index\.html/, async r => { const rep = await r.fetch(); await r.fulfill({ response: rep, body: (await rep.text()).replace("connect-src 'self'", "connect-src 'self' https://serveur-demo.cloud") }); });
  await ctx.route(SRV + '/**', async r => { const q = r.request(), c = JSON.parse(q.postData() || '{}'), h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' }, u = q.url();
    if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
    if (u.endsWith('/life-transfert')) { const d = paquets[c.id]; delete paquets[c.id]; return r.fulfill({ status: d ? 200 : 404, headers: h, body: JSON.stringify(d ? { ok: true, donnees: d } : { ok: false }) }); }
    if (u.endsWith('/app-lien') || u.endsWith('/life')) { cleVue = q.headers()['x-cle-app'] || ''; if (cleVue !== K) return r.fulfill({ status: 403, headers: h, body: '{"ok":false}' });
      if (c.action === 'transfert_deposer') { paquets[c.id] = c.donnees; return r.fulfill({ status: 200, headers: h, body: '{"ok":true,"transfert":true,"expire":1}' }); }
      return r.fulfill({ status: 200, headers: h, body: '{"ok":true}' }); }
    if (u.endsWith('/pilote')) return r.fulfill({ status: q.headers()['x-cle-pilote'] === PIL ? 200 : 403, headers: h, body: '{"ok":true,"onglets":[]}' });
    return r.abort(); });
  return ctx;
}
ok(/item\("[^"]*","Connexion",.{0,6}CLEF\.ouvre/.test(await (await fetch(URL)).text()), 'le menu latéral propose « Connexion »');
const ANC = ['carte-de-vie-lien', 'carte-de-vie-sync', 'coulisses-pilote', 'coulisses-config'];
for (const [nom, profil] of [['App téléphone', TEL], ['App ordinateur', ORDI]]) {
  console.log('— ' + nom);
  const tel = profil === TEL, ANCIEN = { 'carte-de-vie-lien': K, 'carte-de-vie-sync': JSON.stringify({ repo: 'compte-demo/depot-demo', token: J }), 'coulisses-pilote': JSON.stringify({ adresse: SRV, cle: PIL }), 'coulisses-config': JSON.stringify({ depot: 'compte-demo/etat-demo', jeton: J }) };
  const ctx = await contexte(profil, ANCIEN), p = await ctx.newPage(), err = []; p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(URL); await p.waitForTimeout(1500);
  const avant = await p.evaluate(ks => ks.map(k => localStorage.getItem(k)), ANC);
  await ouvreCx(p); await p.waitForSelector('#cleDlg .cx .cx-bloc'); await p.waitForTimeout(400);
  const titres = await p.$$eval('#cleDlg .cx .cx-sous', n => n.map(x => x.textContent));
  ok(titres.join('|') === 'Un QR pour tout connecter|Saisir les codes à la main', nom + ' : l\'écran n\'a que deux blocs : ' + titres.join(' / '));
  ok(/Connexion · Ma carte de vie/.test(await p.textContent('#cleDlg .cx-titre')), nom + ' : le titre porte le nom de l\'app');
  ok(await p.$$eval('#cleDlg .cx .cx-lien, #cleDlg .cx .cx-avance', n => n.length) === 0 && !/Tout tester|Coller un code|Scanner|Avancé/.test(await p.textContent('#cleDlg .cx')), nom + ' : plus de liste d\'état, de « Tout tester », de « Coller », de « Scanner » ni d\'« Avancé »');
  const lab = await p.$$eval('#cleDlg .cx label', n => n.map(x => x.textContent));
  ok(lab.includes('Jeton de synchro GitHub') && lab.includes('Clé des apps') && lab.includes('Adresse du serveur'), nom + ' : libellés clairs : jeton de synchro (GitHub) séparé de la clé des apps');
  ok(await p.$eval('#cx-champ-cle', i => i.type === 'password' && i.value === '' && /Enregistré/.test(i.placeholder)) && await p.$eval('#cx-champ-jeton', i => i.type === 'password' && i.value === ''), nom + ' : les secrets ne sont jamais affichés (champ vide, « Enregistré »)');
  ok(await p.$('#cleDlg .cx-qr') === null, nom + ' : le QR n\'est pas affiché d\'office');
  const apres = await p.evaluate(ks => ks.map(k => localStorage.getItem(k)), ANC);
  ok(JSON.stringify(avant) === JSON.stringify(apres), nom + ' : les anciens rangements sont intacts (rien perdu)');
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('connexion') || 'null') && JSON.parse(localStorage.getItem('connexion')).cle) === K, nom + ' : le rangement unique « connexion » est tenu à jour');
  await p.click('#cleDlg .cx button:has-text("Générer un QR")'); await p.waitForSelector('#cleDlg .cx-qr', { timeout: 8000 });
  const paq = Object.values(paquets).join('');
  ok(await p.$eval('#cleDlg .cx-qr', i => /^data:image\/svg\+xml/.test(i.src) && i.alt.length > 10) && paq.length > 100 && !paq.includes(K) && !paq.includes(J), nom + ' : bouton « Générer un QR » → QR affiché (image nommée) ; le paquet gardé par le système est chiffré');
  const lien = await p.evaluate(() => Connexion.deposer({ carteUrl: location.href.split('#')[0] }));
  ok(/#transfert=/.test(lien) && !lien.includes(K) && !lien.includes(J), nom + ' : le lien du QR ne porte ni clé ni jeton');
  /* UN SEUL QR connecte les trois apps : appareil neuf, trois rangements écrits */
  const ctx2 = await contexte(profil, {}), q = await ctx2.newPage(); q.on('dialog', d => d.accept());
  await q.goto(lien); await q.waitForSelector('#cxRecoit[open]', { timeout: 8000 });
  await q.fill('#cxRecoitSaisie', 'serveur-demo.cloud'); await q.click('#cxRecoitOk');
  await q.waitForFunction(() => /Appareil connecté/.test((document.getElementById('cxRecoit') || {}).textContent || ''), null, { timeout: 8000 });
  await q.waitForTimeout(600);
  const n = await q.evaluate(() => ({ cx: JSON.parse(localStorage.getItem('connexion') || 'null'), lien: localStorage.getItem('carte-de-vie-lien'), sync: JSON.parse(localStorage.getItem('carte-de-vie-sync') || 'null'), repo: document.getElementById('syncRepo').value, tok: document.getElementById('syncToken').value,
    life: JSON.parse(localStorage.getItem('life.cle') || '""'), adr: JSON.parse(localStorage.getItem('life.adresse') || '""'), pi: JSON.parse(localStorage.getItem('coulisses-pilote') || 'null'), cc: JSON.parse(localStorage.getItem('coulisses-config') || 'null'), texte: document.getElementById('cxRecoit').textContent }));
  ok(n.cx && n.cx.cle === K && n.cx.serveur === SRV && (n.cx.depot || (n.cx.attente || {}).depot) === 'compte-demo/depot-demo', nom + ' : UN SEUL QR → rangement commun « connexion » écrit');
  ok(n.lien === K && n.life === K && n.adr === SRV + '/crochets/life', nom + ' : UN SEUL QR → rangements de la carte (clé du lien) et de LIFE (clé, adresse) écrits');
  ok(n.pi && n.pi.cle === PIL && n.pi.adresse === SRV && n.cc && n.cc.depot === 'compte-demo/etat-demo' && n.cc.jeton === J, nom + ' : UN SEUL QR → rangements de Coulisses (pilotage, lecture) écrits');
  ok(n.repo === 'compte-demo/depot-demo' && n.tok === J, nom + ' : UN SEUL QR → synchro de la carte : dépôt et jeton remis à son propre bouton (' + (n.sync ? 'carte-de-vie-sync écrit' : 'liaison lancée') + ')');
  ok(/Connectées sur cet appareil : Ma carte de vie, LIFE, Coulisses\./.test(n.texte) && !n.texte.includes(K) && !n.texte.includes(J), nom + ' : une ligne confirme les apps connectées, sans montrer aucun secret');
  await ctx2.close();
  /* saisie à la main sur un appareil neuf */
  const ctx3 = await contexte(profil, {}), r = await ctx3.newPage(); r.on('dialog', d => d.accept()); await r.goto(URL); await r.waitForTimeout(1200);
  await ouvreCx(r); await r.waitForSelector('#cleDlg .cx #cx-champ-cle');
  await r.fill('#cx-champ-serveur', 'http://pas-https.cloud'); await r.fill('#cx-champ-cle', K); await r.click('#cleDlg .cx button:has-text("Enregistrer")');
  ok(/Forme incorrecte : Adresse du serveur/.test(await r.textContent('#cleDlg .cx-etat')) && await r.evaluate(() => localStorage.getItem('carte-de-vie-lien')) === null, nom + ' : une adresse fausse est refusée en français, rien n\'est enregistré');
  await r.fill('#cx-champ-serveur', SRV); await r.fill('#cx-champ-cle', K); await r.fill('#cx-champ-depot', 'compte-demo/depot-demo'); await r.fill('#cx-champ-jeton', J);
  await r.click('#cleDlg .cx button:has-text("Enregistrer")'); await r.waitForTimeout(900);
  const f = await r.evaluate(() => ({ lien: localStorage.getItem('carte-de-vie-lien'), life: JSON.parse(localStorage.getItem('life.cle') || '""'), repo: document.getElementById('syncRepo').value, page: !document.getElementById('syncPage').hidden }));
  ok(f.lien === K && f.life === K && f.repo === 'compte-demo/depot-demo' && f.page, nom + ' : saisie à la main : clé des apps enregistrée, puis la carte lance sa liaison de synchro');
  await ctx3.close();
  if (!await p.$eval('#cleDlg', d => d.open)) await ouvreCx(p); await p.waitForTimeout(500);
  const m = await p.evaluate(() => ({ h: Math.min(...[...document.querySelectorAll('#cleDlg .cx-btn')].map(x => x.getBoundingClientRect().height)), deb: document.getElementById('cleDlg').scrollWidth > document.getElementById('cleDlg').clientWidth + 1, vis: document.getElementById('cleDlg').getBoundingClientRect().width > 200 }));
  ok(m.h >= (tel ? 44 : 38) && !m.deb && m.vis, nom + ' : boutons assez hauts, pas de débordement');
  ok(err.length === 0, nom + ' : aucune erreur de script' + (err.length ? ' : ' + err.join(' | ') : ''));
  await ctx.close();
}
await b.close(); console.log(ko ? '\n' + ko + ' échec(s)' : '\nTous verts.'); process.exit(ko ? 1 : 0);
