/* Tests de non-régression de « Ma carte de vie », à lancer avant chaque mise en ligne.
   Usage : python3 -m http.server 8767 (à la racine du dépôt), puis node tests/regression.mjs
   Par défaut, une carte de démonstration neutre (ci-dessous) est chargée : le test ne dépend d'aucune donnée réelle.
   CARTE=/chemin/vers/sauvegarde.json : rejoue en plus le parcours sur une sauvegarde (export depuis Réglages).
   CHROMIUM : chemin du navigateur si Playwright ne le trouve pas ; PLAYWRIGHT : chemin du module si besoin. */
const { chromium, devices } = await import(process.env.PLAYWRIGHT || 'playwright');
const URL = process.env.URL || 'http://localhost:8767/index.html', CARTE = process.env.CARTE;
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
let ko = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'KO  ') + m); if (!c) ko++; };
const j = n => { const q = new Date(); q.setDate(q.getDate() - n); return q.toISOString().slice(0, 10); };
const it = (t, done = false) => ({ id: Math.random().toString(36).slice(2, 13), text: t, done });
const esp = (name, groupe, color, x, y, rub, extra = {}) => Object.assign({ name, groupe, color, prio: 2, x, y, rub, tasks: [it('Une tâche de démonstration')], ideas: [it('Une idée')], dates: [], links: [], log: [], _m: Date.now() }, extra);
const DEMO = {
  'espaces/jardin': esp('Jardin', 'Vie perso', '#3E95C9', 30, 30, [
    { id: 'j1', name: 'À planter', items: [it('Tomates'), it('Basilic', true), it('Radis')] },
    { id: 'j2', name: 'Carnet du jardin', journal: true, items: [] },
    { id: 'j3', name: 'Hauteur de la haie', type: 'mesures', libelle: 'Hauteur', unite: 'cm', cible: 180,
      releves: [{ id: 'a', d: j(90), v: 120 }, { id: 'b', d: j(60), v: 131 }, { id: 'c', d: j(30), v: 126, note: 'taille' }],
      gestes: [{ id: 'g1', nom: 'Arroser', days: [j(1), j(2)] }], facteurs: [{ id: 'f1', d: j(45), text: 'Engrais', sens: 'aide' }] }]),
  'espaces/voyage': esp('Voyage', 'Vie perso', '#AD24DB', 65, 25, [
    { id: 'v1', name: 'Envies', items: [it('Islande'), it('Japon')] },
    { id: 'v2', name: 'Pays visités', type: 'monde', pays: ['FR', 'IT'], reves: ['JP'], items: [] },
    { id: 'v3', name: 'Billets', type: 'prix', suivis: [{ id: 's1', nom: 'Vol démonstration', cible: 300, releves: [{ d: j(10), p: 420 }, { d: j(3), p: 380 }] }], items: [] }]),
  'espaces/lecture': esp('Lecture', 'Soi', '#7A4FD6', 40, 65, [
    { id: 'l1', name: 'À lire', items: [it('Un roman'), it('Un essai')] },
    { id: 'l2', name: 'Livres lus cette année', type: 'objectif', cible: 12, actuel: 3, unite: 'livres', pas: 1, items: [] },
    { id: 'l3', name: 'Mes notes', journal: true, items: [] }]),
  'espaces/sport': esp('Sport', 'Corps et santé', '#1F8A5B', 75, 70, [
    { id: 'p1', name: 'Séances', items: [it('Course', true), it('Natation')] },
    { id: 'p2', name: 'Objectif kilomètres', type: 'objectif', cible: 100, actuel: 20, unite: 'km', pas: 5, items: [] }]),
};
const ouvre = async (vp, theme = 'clair') => {
  const ctx = await b.newContext(Object.assign({}, devices['Galaxy S9+'], { viewport: vp || { width: 412, height: 915 }, serviceWorkers: 'block', locale: 'fr-FR', timezoneId: 'Europe/Paris' }));
  await ctx.addInitScript(([carte, theme]) => { if (!sessionStorage.getItem('init')) { sessionStorage.setItem('init', '1'); localStorage.clear(); localStorage.setItem('carte-de-vie-v1', carte);
    ['hRap', 'compagnon', 'mouvements'].forEach(k => localStorage.setItem(k, '0')); localStorage.setItem('carte-de-vie-vu', '1'); localStorage.setItem('theme', theme); } }, [JSON.stringify(DEMO), theme]);
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.goto(URL); if (CARTE) await p.setInputFiles('#impFile', CARTE); await p.waitForTimeout(1800); return { ctx, p, err, cdp: await ctx.newCDPSession(p) }; };
const item = (p, n) => p.evaluate(n => { const x = [...document.querySelectorAll('.node')].find(x => { const t = x.querySelector('b'); return t && t.textContent.replace(/\s+/g, ' ').trim() === n; }); if (x) x.click(); return !!x; }, n);
const ferme = p => p.evaluate(() => document.getElementById('closeBtn').click());
const sel = p => p.evaluate(() => [...document.querySelectorAll('#pane .rpt')].findIndex(b => b.getAttribute('aria-selected') === 'true'));
const debord = p => p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
const glisse = async (cdp, p, x0, y0, x1, y1, ms = 250, attente = 0) => { const n = 14; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] }); if (attente) await p.waitForTimeout(attente);
  for (let i = 1; i <= n; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / n, y: y0 + (y1 - y0) * i / n }] }); await p.waitForTimeout(ms / n); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(500); };
const rub = (p, nom) => p.evaluate(nom => { const t = [...document.querySelectorAll('#pane .rpt')]; const i = t.findIndex(x => x.textContent.includes(nom)); if (i >= 0) t[i].click(); return i; }, nom);
/* ouvre une rubrique seule, en touchant sa tuile (comme on le fait au doigt) */
const tuile = (p, rid) => p.evaluate(rid => { const t = document.querySelector('#pane .rcard[data-rid="' + rid + '"], #pane .mtile[data-rid="' + rid + '"]'); if (t) t.click(); return !!t; }, rid);

{ const { ctx, p, err, cdp } = await ouvre();
  const noms = await p.evaluate(() => [...document.querySelectorAll('.node b')].map(x => x.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean));
  ok(noms.length >= 4, 'la carte affiche ' + noms.length + ' items');
  ok(!(await debord(p)), 'accueil : pas de défilement horizontal');
  /* 1. chaque item s'ouvre ; swipe des pages, lent et rapide */
  for (const n of noms) { await item(p, n); await p.waitForTimeout(500); ok(await p.evaluate(() => !document.getElementById('drawer').hidden), 'ouverture de « ' + n + ' »');
    const np = await p.evaluate(() => document.querySelectorAll('#pane .rpage').length); if (np < 2) { await ferme(p); await p.waitForTimeout(250); continue; }
    let bloque = 0; for (const ms of [220, 900]) { await p.evaluate(() => { const tr = document.querySelector('#pane .rptrack'); tr.scrollTo({ left: 0 }); const d = document.getElementById('drawer'); d.scrollTop = tr.getBoundingClientRect().top + d.scrollTop - 160; }); await p.waitForTimeout(400);
      const y = await p.evaluate(() => { const r = document.querySelector('#pane .rptrack').getBoundingClientRect(); return Math.min(innerHeight - 60, r.top + Math.min(220, r.height / 2)); }); await glisse(cdp, p, 370, y, 60, y + 4, ms); if (await sel(p) !== 1) bloque++; }
    ok(!bloque, 'swipe des pages dans « ' + n + ' » (' + np + ' pages)'); await ferme(p); await p.waitForTimeout(250); }
  /* 2. couleur d'un item (dans la feuille « ✎ Modifier ») */
  await item(p, 'Lecture'); await p.waitForTimeout(600); const sw = await p.evaluate(() => { const m = [...document.querySelectorAll('#drawer button')].find(x => /Modifier/.test(x.textContent) && x.offsetParent); if (m) m.click(); const s = document.querySelector('.swcur'); if (s) s.scrollIntoView({ block: 'center' }); return !!s; });
  if (sw) { await p.tap('.swcur'); await p.waitForTimeout(300); const ouvert = await p.evaluate(() => document.querySelector('#sw .pick').classList.contains('open')); ok(ouvert, 'le choix de couleur s\'ouvre');
    if (ouvert) { await p.tap('#sw .pick button:nth-child(2)'); await p.waitForTimeout(400); ok(await p.evaluate(() => !!getComputedStyle(document.querySelector('.swcur')).getPropertyValue('--c')), 'la couleur s\'applique'); } }
  else ok(false, 'le sélecteur de couleur est présent');
  await ferme(p); await p.waitForTimeout(300);
  /* 3. onglets de pages déplaçables (appui long) */
  const avec = []; for (const n of noms) { await item(p, n); await p.waitForTimeout(400); const k = await p.evaluate(() => document.querySelectorAll('#pane .rpt').length); if (k >= 3) { avec.push(n); break; } await ferme(p); await p.waitForTimeout(200); }
  if (avec.length) { const avant = await p.evaluate(() => [...document.querySelectorAll('#pane .rpt')].map(x => x.textContent).join('|'));
    const pos = await p.evaluate(() => { const t = [...document.querySelectorAll('#pane .rpt')]; const d = document.getElementById('drawer'); d.scrollTop = t[0].getBoundingClientRect().top + d.scrollTop - 300; const a = t[2].getBoundingClientRect(), z = t[1].getBoundingClientRect(); return [a.left + a.width / 2, a.top + a.height / 2, z.left + 4]; });
    await glisse(cdp, p, pos[0], pos[1], pos[2], pos[1] + 2, 400, 550); const apres = await p.evaluate(() => [...document.querySelectorAll('#pane .rpt')].map(x => x.textContent).join('|')); ok(avant !== apres, 'déplacer un onglet de page dans « ' + avec[0] + ' »'); await ferme(p); await p.waitForTimeout(300); }
  /* 4. rubriques graphiques : objectif, prix, mesures */
  await item(p, 'Sport'); await p.waitForTimeout(500); ok(await tuile(p, 'p2'), 'tuile « Objectif kilomètres »'); await p.waitForTimeout(500);
  const km = await p.evaluate(() => { const c = [...document.querySelectorAll('.card.rub.obj')].find(x => x.offsetParent); const bt = c && c.querySelector('.objbtn.plus'); if (bt) bt.click(); return !!bt; }); await p.waitForTimeout(500);
  await p.waitForTimeout(1200); /* la carte est enregistrée sur l'appareil 0,8 s après le dernier geste */
  const v = await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('carte-de-vie-v1')); return d['espaces/sport'].rub.find(r => r.id === 'p2').actuel; });
  ok(km && v === 25, 'objectif chiffré : + 5 km enregistré (' + v + ')'); await ferme(p); await p.waitForTimeout(300);
  await item(p, 'Voyage'); await p.waitForTimeout(500); ok(await tuile(p, 'v3'), 'tuile « Billets »'); await p.waitForTimeout(500);
  const pr = await p.evaluate(() => { const c = [...document.querySelectorAll('.card.rub.prix')].find(x => x.offsetParent); if (!c) return null; const i = c.querySelector('.psuivi input[type=number]'); i.value = '290'; c.querySelector('.psuivi form').requestSubmit(); return true; }); await p.waitForTimeout(600);
  await p.waitForTimeout(1200); const np = await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('carte-de-vie-v1')); return d['espaces/voyage'].rub.find(r => r.id === 'v3').suivis[0].releves.length; });
  ok(pr && np === 3, 'suivi des prix : relevé ajouté (' + np + ')'); await ferme(p); await p.waitForTimeout(300);
  await item(p, 'Jardin'); await p.waitForTimeout(500); ok(await tuile(p, 'j3'), 'tuile « Hauteur de la haie »'); await p.waitForTimeout(500);
  const ms = await p.evaluate(() => { const c = [...document.querySelectorAll('.card.rub.mes')].find(x => x.offsetParent) || document.querySelector('.card.rub.mes'); if (!c) return null; return { t: c.innerText, h: [...c.querySelectorAll('.mesec h4')].length, cases: c.querySelectorAll('.mescase').length }; });
  ok(ms && ms.h === 4 && /\+ 11 cm depuis/i.test(ms.t) && /coupé 5 cm/i.test(ms.t) && ms.cases === 7, 'suivi de mesures : courbe, pousse (+11), coupe (5), gestes (' + (ms && ms.cases) + ' cases)');
  await p.evaluate(() => { const c = document.querySelector('.card.rub.mes'); c.querySelector('.mesform input[type=number]').value = '140'; c.querySelector('.mesform').requestSubmit(); }); await p.waitForTimeout(700);
  await p.evaluate(() => { const c = [...document.querySelectorAll('.card.rub.mes .mescase')]; c[c.length - 1].click(); }); await p.waitForTimeout(500);
  await p.waitForTimeout(1200); const st = await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('carte-de-vie-v1')); const r = d['espaces/jardin'].rub.find(r => r.id === 'j3'); return { n: r.releves.length, g: r.gestes[0].days.length }; });
  ok(st.n === 4 && st.g === 3, 'suivi de mesures : mesure et geste du jour enregistrés ' + JSON.stringify(st));
  ok(!(await debord(p)), 'item ouvert : pas de défilement horizontal'); await ferme(p); await p.waitForTimeout(300);
  /* 4 bis. supprimer une rubrique depuis « ✎ Modifier » (vaut pour tous les espaces, même sur mesure) : second appui pour confirmer */
  await item(p, 'Lecture'); await p.waitForTimeout(500);
  await p.evaluate(() => { const m = [...document.querySelectorAll('#drawer button')].find(x => /Modifier/.test(x.textContent) && x.offsetParent); if (m) m.click(); }); await p.waitForTimeout(500);
  const nb0 = await p.evaluate(() => [...document.querySelectorAll('.v3rdel')].filter(x => x.offsetParent).length);
  await p.evaluate(() => { const d = [...document.querySelectorAll('.v3rubs .v3rrow')].find(x => /À lire/.test(x.textContent)); d.querySelector('.v3rdel').click(); }); await p.waitForTimeout(300);
  const conf = await p.evaluate(() => { const d = [...document.querySelectorAll('.v3rubs .v3rrow')].find(x => /À lire/.test(x.textContent)); const b = d.querySelector('.v3rdel'); const t = b.textContent; b.click(); return t; }); await p.waitForTimeout(1200);
  const rest = await p.evaluate(() => JSON.parse(localStorage.getItem('carte-de-vie-v1'))['espaces/lecture'].rub.map(r => r.name).join('|'));
  ok(nb0 === 3 && /Confirmer \(perd 2 éléments\)/.test(conf) && !/À lire/.test(rest), 'supprimer une rubrique depuis « Modifier » (' + nb0 + ' rubriques, « ' + conf + ' », reste : ' + rest + ')');
  await ferme(p); await p.waitForTimeout(300);
  /* 5. Cuisine (module personnel seulement) : recette → ingrédients */
  if (noms.includes('Cuisine')) { await item(p, 'Cuisine'); await p.waitForTimeout(600); const i = await rub(p, 'courses'); await p.waitForTimeout(800);
    if (i >= 0) { for (const [q, attendu] of [['Curry de légumes', 'Lait de coco'], ['Pâtes au pesto', 'Basilic'], ['Tarte aux pommes', 'Pommes']]) { await p.fill('#fRecette', q); await p.click('.crsrecf button'); await p.waitForTimeout(500);
        const L = await p.evaluate(() => [...document.querySelectorAll('#pane .crs li, #pane li')].map(x => x.textContent).join('|')); ok(L.includes(attendu), 'recette « ' + q + ' » → ' + attendu); } }
    await ferme(p); await p.waitForTimeout(300); }
  ok(!err.length, 'aucune erreur JavaScript' + (err.length ? ' : ' + err.slice(0, 3).join(' / ') : ''));
  await ctx.close(); }
/* 6. thème sombre et ordinateur (1280 px) : la carte et chaque item s'affichent sans erreur */
for (const [vp, theme] of [[{ width: 390, height: 844 }, 'sombre'], [{ width: 1280, height: 900 }, 'clair']]) {
  const { ctx, p, err } = await ouvre(vp, theme); const tag = vp.width + ' ' + theme;
  const n = await p.evaluate(() => document.querySelectorAll('.node').length); ok(n >= 4, tag + ' : la carte s\'affiche (' + n + ')');
  const noms = await p.evaluate(() => [...document.querySelectorAll('.node b')].map(x => x.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean));
  for (const nom of noms) { await item(p, nom); await p.waitForTimeout(500); if (await debord(p)) ok(false, tag + ' : défilement horizontal dans « ' + nom + ' »'); await ferme(p); await p.waitForTimeout(250); }
  ok(!err.length, tag + ' : aucune erreur JavaScript' + (err.length ? ' : ' + err.slice(0, 3).join(' / ') : '')); await ctx.close(); }
/* 7. le carnet de recettes (module personnel seulement) */
{ const { ctx, p } = await ouvre(); const r = await p.evaluate(() => { const R = window._rec; if (!R) return null; return Object.keys(R.base).filter(n => { const a = R.analyse(n); return a.type !== 'base' || a.autres.length; }); });
  if (r) ok(!r.length, 'carnet de recettes : toutes reconnues' + (r.length ? ' (sauf ' + r.join(', ') + ')' : '')); else console.log('--  carnet de recettes : module personnel absent, contrôle sauté');
  await ctx.close(); }
console.log(ko ? ko + ' échec(s)' : 'Tout est bon.'); await b.close(); process.exit(ko ? 1 : 0);
