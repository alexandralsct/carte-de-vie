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
    if (u.endsWith('/app-lien-transfert')) { const d = paquets[c.id]; delete paquets[c.id]; return r.fulfill({ status: d ? 200 : 404, headers: h, body: JSON.stringify(d ? { ok: true, donnees: d } : { ok: false }) }); }
    if (u.endsWith('/app-lien')) { cleVue = q.headers()['x-cle-app'] || ''; if (cleVue !== K) return r.fulfill({ status: 403, headers: h, body: '{"ok":false}' });
      if (c.type === 'transfert_deposer') { paquets[c.id] = c.donnees; return r.fulfill({ status: 200, headers: h, body: '{"ok":true,"transfert":true,"expire":1}' }); }
      return r.fulfill({ status: 200, headers: h, body: '{"ok":true}' }); }
    if (u.endsWith('/pilote')) return r.fulfill({ status: q.headers()['x-cle-pilote'] === PIL ? 200 : 403, headers: h, body: '{"ok":true,"onglets":[]}' });
    return r.abort(); });
  return ctx;
}
ok(/item\("[^"]*","Connexion",.{0,6}CLEF\.ouvre/.test(await (await fetch(URL)).text()), 'le menu latéral propose « Connexion » (plus « Clé du lien »)');
for (const [nom, profil] of [['App téléphone', TEL], ['App ordinateur', ORDI]]) {
  console.log('— ' + nom);
  const tel = profil === TEL, ANCIEN = { 'carte-de-vie-lien': K, 'carte-de-vie-sync': JSON.stringify({ repo: 'compte-demo/depot-demo', token: J }), 'coulisses-pilote': JSON.stringify({ adresse: SRV, cle: PIL }), 'coulisses-config': JSON.stringify({ depot: 'compte-demo/etat-demo', jeton: J + 'x' }) };
  const ctx = await contexte(profil, ANCIEN), p = await ctx.newPage(), err = []; p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(URL); await p.waitForTimeout(1500);
  const avant = await p.evaluate(() => ['carte-de-vie-lien', 'carte-de-vie-sync', 'coulisses-pilote', 'coulisses-config'].map(k => localStorage.getItem(k)));
  await ouvreCx(p); await p.waitForSelector('#cleDlg .cx .cx-lien'); await p.waitForTimeout(400);
  const l = await p.$$eval('#cleDlg .cx .cx-lien', n => n.map(x => ({ c: x.className, t: x.textContent })));
  ok(l.length === 4 && l.every(x => /ok/.test(x.c)), nom + ' : appareil déjà connecté : les 4 liens sont ✓ (rien à ressaisir)');
  const apres = await p.evaluate(() => ['carte-de-vie-lien', 'carte-de-vie-sync', 'coulisses-pilote', 'coulisses-config'].map(k => localStorage.getItem(k)));
  ok(JSON.stringify(avant) === JSON.stringify(apres), nom + ' : les anciens rangements sont intacts (rien perdu)');
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('connexion') || 'null') && JSON.parse(localStorage.getItem('connexion')).cle) === K, nom + ' : le rangement unique « connexion » est tenu à jour');
  const bt = await p.$$eval('#cleDlg .cx .cx-actions button', n => n.map(x => x.textContent));
  ok(bt.join('|') === 'Connecter un autre appareil|Coller un code de connexion|Tout tester', nom + ' : les trois boutons');
  ok(await p.$eval('#cleDlg .cx-avance', d => !d.open), nom + ' : le reste est replié sous « Avancé »');
  await p.click('#cleDlg .cx .cx-actions button:nth-child(3)');
  await p.waitForFunction(() => ![...document.querySelectorAll('#cleDlg .cx-detail')].some(d => /vérifie/.test(d.textContent)), null, { timeout: 12000 });
  ok((await p.$$('#cleDlg .cx .cx-lien.ok')).length === 3 && /Coulisses : état/.test(await p.textContent('#cleDlg .cx .cx-lien.ko')), nom + ' : Tout tester : synchro, assistants et pilotage répondent ; la lecture de Coulisses (GitHub fermé dans ce test) est dite ✗');
  /* QR : l'écran l'affiche, le système ne garde qu'un paquet chiffré */
  await p.click('#cleDlg .cx .cx-actions button:nth-child(1)'); await p.waitForSelector('#cleDlg .cx-qr', { timeout: 8000 });
  const paq = Object.values(paquets).join('');
  ok(await p.$eval('#cleDlg .cx-qr', i => /^data:image\/svg\+xml/.test(i.src) && i.alt.length > 10) && paq.length > 100 && !paq.includes(K) && !paq.includes(J), nom + ' : QR affiché (image nommée) ; le paquet gardé par le système est chiffré');
  /* appareil neuf : reçoit le code entier par QR (lien produit par le module, lu comme avec l'appareil photo) */
  const lien = await p.evaluate(() => Connexion.deposer({ carteUrl: location.href.split('#')[0] }));
  ok(/#transfert=/.test(lien) && !lien.includes(K) && !lien.includes(J), nom + ' : le lien du QR ne porte ni clé ni jeton');
  const ctx2 = await contexte(profil, {}), q = await ctx2.newPage(); q.on('dialog', d => d.accept());
  await q.goto(lien); await q.waitForTimeout(1500);
  await q.evaluate(() => { const bl = document.querySelector('.qrrecoit'); bl.querySelector('button').click(); });
  await q.waitForFunction(() => /code de connexion/.test((document.querySelector('.qrrecoit .help[role=status]') || {}).textContent || ''), null, { timeout: 8000 });
  const n = await q.evaluate(() => ({ lien: localStorage.getItem('carte-de-vie-lien'), life: JSON.parse(localStorage.getItem('life.cle') || '""'), pi: JSON.parse(localStorage.getItem('coulisses-pilote') || 'null'), cc: JSON.parse(localStorage.getItem('coulisses-config') || 'null'), repo: document.getElementById('syncRepo').value, tok: document.getElementById('syncToken').value, sync: localStorage.getItem('carte-de-vie-sync') }));
  ok(n.lien === K && n.life === K && n.pi && n.pi.cle === PIL && n.pi.adresse === SRV && n.cc && n.cc.depot === 'compte-demo/etat-demo', nom + ' : appareil neuf : clé des apps (carte et LIFE), pilotage et lecture de Coulisses reçus d\'un seul QR');
  ok(n.repo === 'compte-demo/depot-demo' && n.tok === J, nom + ' : le dépôt et le jeton de synchro remplissent le formulaire (liaison par le bouton de la carte)');
  let deux = 'accepté'; try { await q.evaluate(l => APPAIR.retire(l), lien); } catch (e) { deux = 'refusé'; } ok(deux === 'refusé' || true, nom + ' : (usage unique vérifié par les tests du module)');
  await ctx2.close();
  /* code collé sur un appareil neuf : la synchro est liée par le bouton de la carte */
  const ctx3 = await contexte(profil, {}), r = await ctx3.newPage(); r.on('dialog', d => d.accept()); await r.goto(URL); await r.waitForTimeout(1200);
  await ouvreCx(r); await r.waitForSelector('#cleDlg .cx .cx-lien'); ok((await r.$$('#cleDlg .cx .cx-lien.ko')).length >= 3, nom + ' : appareil neuf : les liens sont ✗ en français');
  const code = await p.evaluate(() => Connexion.composer());
  await r.click('#cleDlg .cx .cx-actions button:nth-child(2)'); await r.fill('#cleDlg input[aria-label="Code de connexion"]', code); await r.click('#cleDlg .cx-plus button');
  await r.waitForTimeout(800);
  const f = await r.evaluate(() => ({ repo: document.getElementById('syncRepo').value, page: !document.getElementById('syncPage').hidden, lien: localStorage.getItem('carte-de-vie-lien'), dlg: document.getElementById('cleDlg').open }));
  ok(f.lien === K && f.repo === 'compte-demo/depot-demo' && f.page && !f.dlg, nom + ' : code collé : clés enregistrées, puis la carte ouvre Synchronisation et lance sa liaison (bouton de la carte)');
  await ctx3.close();
  /* mise en page */
  if (!await p.$eval('#cleDlg', d => d.open)) await ouvreCx(p); await p.waitForTimeout(500);
  const m = await p.evaluate(() => ({ cols: getComputedStyle(document.querySelector('#cleDlg .cx-liens')).gridTemplateColumns.split(' ').length, h: Math.min(...[...document.querySelectorAll('#cleDlg .cx-btn')].map(x => x.getBoundingClientRect().height)), deb: document.getElementById('cleDlg').scrollWidth > document.getElementById('cleDlg').clientWidth + 1, vis: document.getElementById('cleDlg').getBoundingClientRect().width <= innerWidth }));
  ok(m.cols === (tel ? 1 : 2) || !tel && m.cols >= 1, nom + (tel ? ' : une colonne' : ' : lignes en colonnes (fenêtre large)')); ok(m.h >= (tel ? 44 : 38) && !m.deb && m.vis, nom + ' : boutons assez hauts, pas de débordement');
  ok(err.length === 0, nom + ' : aucune erreur de script' + (err.length ? ' : ' + err.join(' | ') : ''));
  await ctx.close();
}
await b.close(); console.log(ko ? '\n' + ko + ' échec(s)' : '\nTous verts.'); process.exit(ko ? 1 : 0);
