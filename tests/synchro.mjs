/* Tests de la synchronisation avec un faux GitHub (aucun réseau, aucune donnée réelle), en deux parties : App téléphone puis App ordinateur.
   Usage : python3 -m http.server 8767 (à la racine du dépôt), puis node tests/synchro.mjs
   Vérifie : lecture d'un fichier de plus de 1 Mo (synchro et « Mémoire »), envoi après une modification (format du fichier, heures
   _f et _h), fusion avec une modification faite en même temps ailleurs, reprise après un conflit 409, import d'une sauvegarde
   (fusion avec confirmation : les documents créés après elle sont gardés), horloge de l'appareil en retard de 2 jours (recalée sur
   l'heure du serveur), stockage de l'appareil plein (rien de perdu au rechargement). */
const { chromium, devices } = await import(process.env.PLAYWRIGHT || 'playwright');
const URL = process.env.URL || 'http://localhost:8767/index.html';
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
let ko = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'KO  ') + m); if (!c) ko++; };
const T0 = Date.now() - 3600e3;
const it = (id, t, done = false) => ({ id, text: t, done });
const carte = () => ({
  'espaces/sport': { name: 'Sport', groupe: 'Corps et santé', color: '#1F8A5B', prio: 2, x: 70, y: 60, tasks: [], ideas: [], dates: [], links: [], log: [],
    rub: [{ id: 'p1', name: 'Séances', items: [it('s1', 'Course'), it('s2', 'Natation')] }, { id: 'p2', name: 'Objectif kilomètres', type: 'objectif', cible: 100, actuel: 20, unite: 'km', pas: 5, items: [] }],
    _m: T0, _f: { name: T0, groupe: T0, color: T0, prio: T0, x: T0, y: T0, tasks: T0, ideas: T0, dates: T0, links: T0, log: T0, rub: T0 } },
  'espaces/lecture': { name: 'Lecture', groupe: 'Soi', color: '#7A4FD6', prio: 2, x: 30, y: 40, tasks: [it('t1', 'Un roman')], ideas: [], dates: [], links: [], log: [], rub: [], _m: T0 },
  /* un document lourd et neutre : le fichier dépasse 1 Mo, GitHub ne renvoie alors plus le contenu avec ses métadonnées */
  'meta/notes': { liste: [{ id: 'n1', texte: 'x'.repeat(1100000), t: '2026-01-01' }], _m: T0 } });
/* faux dépôt : un fichier, son historique, ETag, 304, 409 sur un sha périmé */
const depot = () => { const D = { versions: [], puts: [], conflit: 0 }; D.ecrit = (o, msg) => { const texte = JSON.stringify(o, null, 1); D.versions.unshift({ sha: 'v' + (D.versions.length + 1) + 'a'.repeat(38), texte, msg, date: new Date().toISOString() }); }; return D; };
const route = D => async rt => { const r = rt.request(), u = new globalThis.URL(r.url()), cur = D.versions[0], h = r.headers();
  const json = (o, st = 200, en = {}) => rt.fulfill({ status: st, contentType: 'application/json', headers: Object.assign({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'ETag' }, en), body: JSON.stringify(o) });
  if (r.method() === 'OPTIONS') return rt.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,PUT', 'Access-Control-Expose-Headers': 'ETag' } });
  if (/\/commits$/.test(u.pathname)) return json(D.versions.map(v => ({ sha: v.sha, commit: { committer: { date: v.date } } })));
  if (!/\/contents\/carte\.json$/.test(u.pathname)) return json({ message: 'Not Found' }, 404);
  if (r.method() === 'PUT') { const corps = JSON.parse(r.postData()); if (D.conflit > 0) { D.conflit--; return json({ message: 'conflict' }, 409); }
    if (cur && corps.sha !== cur.sha) return json({ message: 'sha' }, 409); const texte = Buffer.from(corps.content, 'base64').toString('utf8'); D.puts.push(texte);
    D.versions.unshift({ sha: 'v' + (D.versions.length + 1) + 'b'.repeat(38), texte, msg: corps.message, date: new Date().toISOString() }); return json({ content: { sha: D.versions[0].sha } }); }
  const v = u.searchParams.get('ref') ? D.versions.find(x => x.sha === u.searchParams.get('ref')) : cur; if (!v) return json({ message: 'Not Found' }, 404);
  if (/raw/.test(h.accept || '')) return rt.fulfill({ status: 200, contentType: 'application/vnd.github.raw', headers: { 'Access-Control-Allow-Origin': '*' }, body: v.texte });
  if (!u.searchParams.get('ref') && h['if-none-match'] === '"' + v.sha + '"') return rt.fulfill({ status: 304, headers: { 'Access-Control-Allow-Origin': '*', 'ETag': '"' + v.sha + '"' } });
  const gros = v.texte.length > 1e6; return json({ sha: v.sha, size: v.texte.length, encoding: gros ? 'none' : 'base64', content: gros ? '' : Buffer.from(v.texte).toString('base64') }, 200, { ETag: '"' + v.sha + '"' }); };
const PROFILS = [['App téléphone', Object.assign({}, devices['Galaxy S9+'], { viewport: { width: 412, height: 915 } })],
  ['App ordinateur', { viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false }]];
const lit = D => JSON.parse(D.versions[0].texte);
for (const [nom, opt] of PROFILS) {
  console.log('\n== ' + nom);
  const D = depot(); D.ecrit(carte(), 'départ');
  const ctx = await b.newContext(Object.assign({}, opt, { serviceWorkers: 'block', locale: 'fr-FR', timezoneId: 'Europe/Paris' }));
  await ctx.route('https://api.github.com/**', route(D));
  await ctx.addInitScript(() => { if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1'); localStorage.clear();
    localStorage.setItem('carte-de-vie-sync', JSON.stringify({ repo: 'exemple/donnees', token: 'jeton-fictif' })); ['hRap', 'compagnon', 'mouvements'].forEach(k => localStorage.setItem(k, '0')); localStorage.setItem('carte-de-vie-vu', '1'); });
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message)); const dialogues = []; p.on('dialog', d => { dialogues.push(d.message()); d.accept(); });
  await p.goto(URL); await p.waitForFunction(() => document.querySelectorAll('.node').length >= 2, null, { timeout: 15000 }).catch(() => {});
  await p.waitForFunction(() => /Synchronisé/.test((document.getElementById('syncMsg') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
  ok(/Synchronisé/.test(await p.evaluate(() => document.getElementById('syncMsg').textContent)), nom + ' : fichier de plus de 1 Mo lu et synchronisé');
  ok(await p.evaluate(() => [...document.querySelectorAll('.node b')].some(x => /Sport/.test(x.textContent))), nom + ' : les espaces du fichier s\'affichent');
  /* une modification sur l'appareil, et en même temps une autre ailleurs (un autre appareil ajoute une séance) */
  const ouvre = n => p.evaluate(n => { const x = [...document.querySelectorAll('.node')].find(x => (x.querySelector('b') || {}).textContent?.trim() === n); if (x) x.click(); return !!x; }, n);
  await ouvre('Sport'); await p.waitForTimeout(600);
  await p.evaluate(() => { const t = document.querySelector('#pane .rcard[data-rid="p2"], #pane .mtile[data-rid="p2"]'); if (t) t.click(); }); await p.waitForTimeout(500);
  const plus = await p.evaluate(() => { const c = [...document.querySelectorAll('.card.rub.obj')].find(x => x.offsetParent) || document.querySelector('.card.rub.obj'); const bt = c && c.querySelector('.objbtn.plus'); if (bt) bt.click(); return !!bt; });
  ok(plus, nom + ' : modification faite dans l\'app (objectif + 5)');
  { const o = lit(D); o['espaces/sport'].rub[0].items.push(it('s3', 'Vélo (autre appareil)')); const t = Date.now() + 1; o['espaces/sport']._m = t; o['espaces/sport']._f.rub = t; D.ecrit(o, 'autre appareil'); }
  D.conflit = 1; /* le premier envoi tombe sur un conflit : l'app doit relire et renvoyer */
  await p.evaluate(() => document.getElementById('syncNow').click());
  for (let i = 0; i < 40 && !D.puts.length; i++) await p.waitForTimeout(500);
  for (let i = 0; i < 20 && !/Synchronisé/.test(await p.evaluate(() => document.getElementById('syncMsg').textContent)); i++) await p.waitForTimeout(500);
  const fin = lit(D), sp = fin['espaces/sport'], r2 = sp.rub.find(r => r.id === 'p2'), r1 = sp.rub.find(r => r.id === 'p1');
  ok(D.puts.length >= 1 && r2.actuel === 25 && r1.items.some(x => x.id === 's3'), nom + ' : envoi après un conflit 409 ; la modification de l\'app (' + r2.actuel + ' km) et celle de l\'autre appareil (' + r1.items.length + ' séances) sont gardées');
  ok(D.puts.length && /^\{\n "/.test(D.puts[D.puts.length - 1]), nom + ' : le fichier envoyé garde l\'indentation d\'un espace (règle du dépôt de données)');
  ok(typeof sp._f.rub === 'number' && sp._f.rub > T0 && sp._f.name === T0 && typeof r2._h === 'number' && r1.items.find(x => x.id === 's1')._h === undefined, nom + ' : heures posées seulement sur ce qui a changé (_f.rub, _h de la rubrique modifiée)');
  ok(fin['meta/notes'].liste[0].texte.length === 1100000 && fin['espaces/lecture'].tasks.length === 1, nom + ' : le reste de la carte est intact');
  /* « Mémoire » : comparer une ancienne version de plus de 1 Mo */
  await p.evaluate(() => document.getElementById('memSel').click()); await p.waitForFunction(() => document.querySelectorAll('#memSel option').length > 1, null, { timeout: 8000 }).catch(() => {});
  await p.evaluate(() => { const s = document.getElementById('memSel'); s.value = s.options[s.options.length - 1].value; document.getElementById('memGo').click(); });
  await p.waitForFunction(() => !/Comparaison/.test(document.getElementById('memOut').textContent), null, { timeout: 8000 }).catch(() => {});
  const mem = await p.evaluate(() => document.getElementById('memOut').textContent);
  ok(!/Impossible/.test(mem) && mem.length > 0, nom + ' : « Mémoire » lit une version de plus de 1 Mo (« ' + mem.slice(0, 60) + ' »)');
  /* import d'une sauvegarde : elle l'emporte sur ce qui a changé en ligne depuis, sans rien perdre de ce qui a été ajouté */
  { const sauv = carte(); delete sauv['meta/notes']; sauv['espaces/lecture'].name = 'Lecture (sauvegarde)'; const o = lit(D); o['espaces/lecture'].name = 'Lecture (en ligne)'; o['espaces/lecture'].tasks.push(it('t2', 'Ajoutée en ligne')); const t = Date.now() + 5; o['espaces/lecture']._m = t; o['espaces/lecture']._f = { name: t, tasks: t };
    o['espaces/nouveau'] = { name: 'Créé après la sauvegarde', groupe: 'Soi', color: '#3E95C9', prio: 2, x: 50, y: 50, tasks: [it('n1', 'x')], ideas: [], dates: [], links: [], log: [], rub: [], _m: t, _f: { name: t } }; D.ecrit(o, 'en ligne');
    await p.setInputFiles('#impFile', { name: 'sauvegarde.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(sauv)) }); await p.waitForTimeout(800);
    const n0 = D.puts.length; await p.evaluate(() => document.getElementById('syncNow').click()); for (let i = 0; i < 30 && D.puts.length === n0; i++) await p.waitForTimeout(500);
    const f2 = lit(D), l = f2['espaces/lecture']; ok(l.name === 'Lecture (sauvegarde)' && l.tasks.some(x => x.id === 't2'), nom + ' : import d\'une sauvegarde : elle l\'emporte (' + l.name + '), la tâche ajoutée en ligne est gardée');
    ok(dialogues.some(m => /Importer cette sauvegarde/.test(m)), nom + ' : l\'import demande confirmation');
    ok(f2['espaces/nouveau'] && !f2['espaces/nouveau']._del && f2['meta/notes'] && !f2['meta/notes']._del && f2['meta/notes'].liste[0].texte.length === 1100000, nom + ' : import : un espace créé après la sauvegarde et un document absent de la sauvegarde ne sont pas supprimés'); }
  ok(!err.length, nom + ' : aucune erreur JavaScript' + (err.length ? ' : ' + err.slice(0, 2).join(' / ') : ''));
  await ctx.close();
}
/* horloge de l'appareil en retard de 2 jours : recalée sur l'heure du serveur (réponse du site, puis date du commit) ; ce qui est
   écrit porte l'heure du serveur, et l'app le signale */
for (const [nom, opt] of PROFILS) {
  console.log('\n== ' + nom + ' : horloge en retard de 2 jours');
  const D = depot(); D.ecrit(carte(), 'départ'); const ctx = await b.newContext(Object.assign({}, opt, { serviceWorkers: 'block', locale: 'fr-FR', timezoneId: 'Europe/Paris' }));
  await ctx.route('https://api.github.com/**', async rt => { if (rt.request().method() === 'PUT') { const r = await rt.fetch().catch(() => null); }
    const f = route(D); if (rt.request().method() !== 'PUT') return f(rt); const corps = JSON.parse(rt.request().postData()); const texte = Buffer.from(corps.content, 'base64').toString('utf8'); D.puts.push(texte);
    D.versions.unshift({ sha: 'v' + (D.versions.length + 1) + 'c'.repeat(38), texte, msg: corps.message, date: new Date().toISOString() });
    return rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ content: { sha: D.versions[0].sha }, commit: { committer: { date: new Date().toISOString() } } }) }); });
  await ctx.addInitScript(() => { const V = Date, off = -2 * 864e5; class F extends V { constructor(...a) { if (a.length) super(...a); else super(V.now() + off); } static now() { return V.now() + off; } } window.Date = F;
    if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1'); localStorage.clear();
    localStorage.setItem('carte-de-vie-sync', JSON.stringify({ repo: 'exemple/donnees', token: 'jeton-fictif' })); ['hRap', 'compagnon', 'mouvements'].forEach(k => localStorage.setItem(k, '0')); localStorage.setItem('carte-de-vie-vu', '1'); });
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.goto(URL); await p.waitForFunction(() => /Synchronisé/.test((document.getElementById('syncMsg') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(1500);
  await p.evaluate(() => { const x = [...document.querySelectorAll('.node')].find(x => (x.querySelector('b') || {}).textContent?.trim() === 'Sport'); if (x) x.click(); }); await p.waitForTimeout(600);
  await p.evaluate(() => { const t = document.querySelector('#pane .rcard[data-rid="p2"], #pane .mtile[data-rid="p2"]'); if (t) t.click(); }); await p.waitForTimeout(500);
  await p.evaluate(() => { const c = [...document.querySelectorAll('.card.rub.obj')].find(x => x.offsetParent) || document.querySelector('.card.rub.obj'); const bt = c && c.querySelector('.objbtn.plus'); if (bt) bt.click(); });
  const n0 = D.puts.length; await p.evaluate(() => document.getElementById('syncNow').click()); for (let i = 0; i < 30 && D.puts.length === n0; i++) await p.waitForTimeout(500);
  for (let i = 0; i < 10 && !/retarde/.test(await p.evaluate(() => document.getElementById('syncMsg').textContent)); i++) await p.waitForTimeout(500);
  const sp = lit(D)['espaces/sport'], ecart = Math.round((Date.now() - sp._f.rub) / 60e3), msg = await p.evaluate(() => document.getElementById('syncMsg').textContent);
  ok(sp.rub.find(r => r.id === 'p2').actuel === 25 && Math.abs(ecart) < 5, nom + ' : la modification est datée à l\'heure du serveur (écart ' + ecart + ' min), pas 2 jours plus tôt');
  ok(/retarde de 2 jours/.test(msg), nom + ' : l\'app signale l\'horloge décalée (« ' + msg.slice(0, 70) + '… »)');
  ok(!err.length, nom + ' : aucune erreur JavaScript' + (err.length ? ' : ' + err.slice(0, 2).join(' / ') : '')); await ctx.close();
}
/* stockage de l'appareil plein (quota partagé rempli par une autre app du même site) : la modification est gardée dans la réserve,
   signalée, et retrouvée au rechargement ; quand la place revient, la réserve est réécrite dans le stockage normal puis effacée */
for (const [nom, opt] of PROFILS) {
  console.log('\n== ' + nom + ' : stockage plein');
  const ctx = await b.newContext(Object.assign({}, opt, { serviceWorkers: 'block', locale: 'fr-FR', timezoneId: 'Europe/Paris' }));
  await ctx.addInitScript(c => { if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1'); localStorage.clear(); localStorage.setItem('carte-de-vie-v1', c);
    ['hRap', 'compagnon', 'mouvements'].forEach(k => localStorage.setItem(k, '0')); localStorage.setItem('carte-de-vie-vu', '1'); }, JSON.stringify((({ ['meta/notes']: _, ...r }) => r)(carte())));
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.goto(URL); await p.waitForFunction(() => document.querySelectorAll('.node').length >= 2, null, { timeout: 15000 }).catch(() => {});
  /* une autre app remplit le stockage commun */
  await p.evaluate(() => { let n = 4e6; const s = 'x'.repeat(1e5); let i = 0; while (n >= 1) { try { localStorage.setItem('autre-app-' + i, s.slice(0, n > 1e5 ? 1e5 : n)); i++; } catch { n = Math.floor(n / 2); } } });
  await p.evaluate(() => { const x = [...document.querySelectorAll('.node')].find(x => (x.querySelector('b') || {}).textContent?.trim() === 'Sport'); if (x) x.click(); }); await p.waitForTimeout(600);
  await p.evaluate(() => { const t = document.querySelector('#pane .rcard[data-rid="p2"], #pane .mtile[data-rid="p2"]'); if (t) t.click(); }); await p.waitForTimeout(500);
  await p.evaluate(() => { const c = [...document.querySelectorAll('.card.rub.obj')].find(x => x.offsetParent) || document.querySelector('.card.rub.obj'); const bt = c && c.querySelector('.objbtn.plus'); if (bt) bt.click(); });
  await p.waitForTimeout(1500);
  const band = await p.evaluate(() => { const e = document.getElementById('stockPlein'); return !!e && !e.hidden && /plein/.test(e.textContent); });
  const enLS = await p.evaluate(() => JSON.parse(localStorage.getItem('carte-de-vie-v1'))['espaces/sport'].rub.find(r => r.id === 'p2').actuel);
  ok(band && enLS === 20, nom + ' : stockage plein détecté et signalé par un bandeau (le stockage normal n\'a pas pu être écrit : ' + enLS + ' km)');
  await p.reload(); await p.waitForFunction(() => document.querySelectorAll('.node').length >= 2, null, { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(1500);
  const apres = await p.evaluate(() => { const c = [...document.querySelectorAll('.node')].find(x => (x.querySelector('b') || {}).textContent?.trim() === 'Sport'); if (c) c.click(); return new Promise(r => setTimeout(() => r(document.body.innerText.includes('25')), 700)); });
  ok(apres, nom + ' : après rechargement, la modification faite pendant que le stockage était plein est là (25 km)');
  await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('autre-app-')).forEach(k => localStorage.removeItem(k))); await p.reload(); await p.waitForTimeout(2500);
  const fin = await p.evaluate(() => ({ v: JSON.parse(localStorage.getItem('carte-de-vie-v1'))['espaces/sport'].rub.find(r => r.id === 'p2').actuel, c: /cdvSecours=1/.test(document.cookie) }));
  ok(fin.v === 25 && !fin.c, nom + ' : la place revenue, la réserve est réécrite dans le stockage normal (' + fin.v + ' km) puis effacée');
  ok(!err.length, nom + ' : aucune erreur JavaScript' + (err.length ? ' : ' + err.slice(0, 2).join(' / ') : '')); await ctx.close();
}
console.log(ko ? '\n' + ko + ' échec(s)' : '\nTout est bon.'); await b.close(); process.exit(ko ? 1 : 0);
