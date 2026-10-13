/* Tests de non-régression de « Ma carte de vie », à lancer avant chaque mise en ligne.
   Usage : python3 -m http.server 8767 (à la racine du dépôt), puis node tests/regression.mjs
   Par défaut, une carte de démonstration neutre (ci-dessous) est chargée : le test ne dépend d'aucune donnée réelle.
   CARTE=/chemin/vers/sauvegarde.json : rejoue en plus le parcours sur une sauvegarde (export depuis Réglages).
   CHROMIUM : chemin du navigateur si Playwright ne le trouve pas ; PLAYWRIGHT : chemin du module si besoin.
   Deux parties, comme deux produits : « App téléphone » (Galaxy S9+ émulé, tactile, 412 et 390 px) puis « App ordinateur »
   (souris, 1280 px, pointer:fine : les règles de l'app ordinateur s'appliquent vraiment), avec quelques budgets de performance. */
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
/* app téléphone : Galaxy S9+ émulé (tactile) à 412 px de large, comme avant (le profil de Playwright seul fait 320 px) */
const TEL = Object.assign({}, devices['Galaxy S9+'], { viewport: { width: 412, height: 915 } }), ORDI = { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false };
const ouvre = async (vp, theme = 'clair', profil = TEL) => {
  const ctx = await b.newContext(Object.assign({}, profil, { viewport: vp || profil.viewport || { width: 412, height: 915 }, serviceWorkers: 'block', locale: 'fr-FR', timezoneId: 'Europe/Paris' }));
  /* règle de sécurité (CSP) : toute violation est notée (un script ou une ressource bloqués casseraient l'app en silence) */
  await ctx.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + (e.blockedURI || ''))); });
  await ctx.addInitScript(([carte, theme]) => { if (!sessionStorage.getItem('init')) { sessionStorage.setItem('init', '1'); localStorage.clear(); localStorage.setItem('carte-de-vie-v1', carte);
    ['hRap', 'compagnon', 'mouvements'].forEach(k => localStorage.setItem(k, '0')); localStorage.setItem('carte-de-vie-vu', '1'); localStorage.setItem('theme', theme); } }, [JSON.stringify(DEMO), theme]);
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.goto(URL); if (CARTE) await p.setInputFiles('#impFile', CARTE); await p.waitForTimeout(1800); return { ctx, p, err, cdp: await ctx.newCDPSession(p) }; };
const csp = async (p, tag) => { const v = await p.evaluate(() => window.__csp || []); ok(!v.length, tag + ' : aucune violation de la règle de sécurité (CSP)' + (v.length ? ' : ' + v.slice(0, 3).join(' / ') : ''));
  /* seconde règle posée à l'exécution : connexions limitées aux adresses exactes (ici aucune adresse personnelle : un domaine .cloud
     quelconque et un Apps Script quelconque, permis par la première règle, sont bloqués) */
  const s = await p.evaluate(async () => { const n = document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]').length;
    const t = u => fetch(u).then(() => 'passe', e => 'bloque'); const a = await t('https://quelconque.cloud/x'), b = await t('https://script.google.com/macros/s/quelconque/exec');
    await new Promise(r => setTimeout(r, 400)); const v = (window.__csp || []).filter(x => /connect-src/.test(x)).length; return { n, a, b, v }; });
  ok(s.n === 2 && s.a === 'bloque' && s.b === 'bloque' && s.v >= 2, tag + ' : seconde règle de sécurité à l\'exécution (' + s.n + ' règles) : domaine .cloud et Apps Script quelconques bloqués ' + JSON.stringify(s)); };
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

/* la règle de sécurité n'autorise que les scripts de la page, par empreinte (ni 'unsafe-inline', ni adresse quelconque) */
{ const h = await (await fetch(URL)).text(), m = /script-src ([^;]*);/.exec(h), src = m ? m[1] : '';
  ok(m && /'sha256-/.test(src) && !/unsafe-inline/.test(src) && !/(^| )(https?:|\*)( |$)/.test(src), 'règle de sécurité : scripts autorisés par empreinte seulement, sans \'unsafe-inline\''); }
/* séparation des deux apps dans le CSS : l'app ordinateur n'a qu'une référence, « (min-width:900px) and (pointer:fine) », et l'app
   téléphone son complément exact ; les autres seuils de largeur (mises en page fluides) ne peuvent que diminuer */
{ const h = await (await fetch(URL)).text(), css = [...h.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n'), N = {};
  for (const m of css.matchAll(/@media([^{]*)\{/g)) { const q = m[1].replace(/\s+/g, ' ').trim(); N[q] = (N[q] || 0) + 1; }
  const ORDI_Q = '(min-width:900px) and (pointer:fine)', TEL_Q = 'not all and (min-width:900px) and (pointer:fine)';
  const BASE = { '(min-width:700px)': 3, '(max-width:460px)': 1, '(max-width:720px)': 1, '(orientation:landscape) and (max-height:520px)': 1, '(max-width:760px)': 6, '(min-width:760px)': 1,
    '(max-width:520px)': 1, '(max-width:420px)': 2, '(min-width:761px)': 11, '(min-width:821px)': 1, '(min-width:1000px)': 2, '(prefers-reduced-motion:reduce)': 5 /* pas un seuil de largeur : « moins de mouvement » */ };
  const hors = Object.entries(N).filter(([q, n]) => q !== ORDI_Q && q !== TEL_Q && !(n <= (BASE[q] || 0)));
  ok(N[ORDI_Q] >= 1 && !hors.length, 'CSS : une seule référence pour l\'app ordinateur (' + (N[ORDI_Q] || 0) + ' blocs) et son complément pour l\'app téléphone (' + (N[TEL_Q] || 0) + ') ; aucun nouveau seuil' + (hors.length ? ' — nouveaux : ' + hors.map(([q, n]) => q + ' ×' + n).join(', ') : ''));
  const enMoins = Object.entries(BASE).filter(([q, n]) => (N[q] || 0) < n); if (enMoins.length) console.log('--  seuils en baisse (abaisser BASE) : ' + enMoins.map(([q]) => q).join(', ')); }
console.log('== App téléphone');
{ const { ctx, p, err, cdp } = await ouvre();
  const noms = await p.evaluate(() => [...document.querySelectorAll('.node b')].map(x => x.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean));
  ok(noms.length >= 4, 'la carte affiche ' + noms.length + ' items');
  ok(!(await debord(p)), 'accueil : pas de défilement horizontal');
  ok(await p.evaluate(() => !matchMedia('(min-width:900px) and (pointer:fine)').matches && !document.documentElement.classList.contains('ordi')), 'contexte tactile : les règles de l\'app ordinateur ne s\'appliquent pas');
  /* 1. chaque item s'ouvre ; swipe des pages, lent et rapide */
  for (const n of noms) { await item(p, n); await p.waitForTimeout(500); ok(await p.evaluate(() => !document.getElementById('drawer').hidden), 'ouverture de « ' + n + ' »');
    const np = await p.evaluate(() => document.querySelectorAll('#pane .rpage').length); if (np < 2) { await ferme(p); await p.waitForTimeout(250); continue; }
    let bloque = 0; for (const ms of [220, 900]) { await p.evaluate(() => { const tr = document.querySelector('#pane .rptrack'); tr.scrollTo({ left: 0 }); const d = document.getElementById('drawer'); d.scrollTop = tr.getBoundingClientRect().top + d.scrollTop - 160; }); await p.waitForTimeout(400);
      const y = await p.evaluate(() => { const r = document.querySelector('#pane .rptrack').getBoundingClientRect(); return Math.min(innerHeight - 60, r.top + Math.min(220, r.height / 2)); }); await glisse(cdp, p, 370, y, 60, y + 4, ms);
      if (await sel(p) !== 1) bloque++; }
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
  const nb0 = await p.evaluate(() => [...document.querySelectorAll('.v3rubs:not(.v3pages) .v3rdel')].filter(x => x.offsetParent).length);
  await p.evaluate(() => { const d = [...document.querySelectorAll('.v3rubs .v3rrow')].find(x => /À lire/.test(x.textContent)); d.querySelector('.v3rdel').click(); }); await p.waitForTimeout(300);
  const conf = await p.evaluate(() => { const d = [...document.querySelectorAll('.v3rubs .v3rrow')].find(x => /À lire/.test(x.textContent)); const b = d.querySelector('.v3rdel'); const t = b.textContent; b.click(); return t; }); await p.waitForTimeout(1200);
  const rest = await p.evaluate(() => JSON.parse(localStorage.getItem('carte-de-vie-v1'))['espaces/lecture'].rub.map(r => r.name).join('|'));
  ok(nb0 === 3 && /Confirmer \(perd 2 éléments\)/.test(conf) && !/À lire/.test(rest), 'supprimer une rubrique depuis « Modifier » (' + nb0 + ' rubriques, « ' + conf + ' », reste : ' + rest + ')');
  /* 4 ter. retirer puis remettre une page de l'espace (« Pages de l'espace » dans « ✎ Modifier ») */
  const ong = () => p.evaluate(() => [...document.querySelectorAll('#pane .rpnav .rpt')].map(x => x.textContent.trim()));
  const o0 = await ong(), cible = o0[o0.length - 1];
  const bascule = n => p.evaluate(n => { const r = [...document.querySelectorAll('.v3pages .v3rrow')].find(x => x.querySelector('.v3rn').textContent === n); if (r) r.querySelector('button').click(); return !!r; }, n);
  ok(await bascule(cible), 'page « ' + cible + ' » listée dans « Pages de l\'espace »'); await p.waitForTimeout(1300);
  const o1 = await ong(), dsp = await p.evaluate(() => (JSON.parse(localStorage.getItem('carte-de-vie-v1'))['espaces/lecture'].disp || {}).cachees);
  ok(!o1.includes(cible) && o1.length === o0.length - 1 && JSON.stringify(dsp) === JSON.stringify([cible]), 'page retirée : ' + o1.join(' | '));
  await bascule(cible); await p.waitForTimeout(1300); ok((await ong()).includes(cible), 'page remise');
  await ferme(p); await p.waitForTimeout(300);
  /* 5. Cuisine (module personnel seulement) : recette → ingrédients */
  if (noms.includes('Cuisine')) { await item(p, 'Cuisine'); await p.waitForTimeout(600); const i = await rub(p, 'courses'); await p.waitForTimeout(800);
    if (i >= 0) { for (const [q, attendu] of [['Curry de légumes', 'Lait de coco'], ['Pâtes au pesto', 'Basilic'], ['Tarte aux pommes', 'Pommes']]) { await p.fill('#fRecette', q); await p.click('.crsrecf button'); await p.waitForTimeout(500);
        const L = await p.evaluate(() => [...document.querySelectorAll('#pane .crs li, #pane li')].map(x => x.textContent).join('|')); ok(L.includes(attendu), 'recette « ' + q + ' » → ' + attendu); } }
    await ferme(p); await p.waitForTimeout(300); }
  ok(!err.length, 'aucune erreur JavaScript' + (err.length ? ' : ' + err.slice(0, 3).join(' / ') : ''));
  await csp(p, 'App téléphone');
  await ctx.close(); }
/* 6. thème sombre (app téléphone, 390 px) : la carte et chaque item s'affichent sans erreur */
for (const [vp, theme] of [[{ width: 390, height: 844 }, 'sombre']]) {
  const { ctx, p, err } = await ouvre(vp, theme); const tag = vp.width + ' ' + theme;
  const n = await p.evaluate(() => document.querySelectorAll('.node').length); ok(n >= 4, tag + ' : la carte s\'affiche (' + n + ')');
  const noms = await p.evaluate(() => [...document.querySelectorAll('.node b')].map(x => x.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean));
  for (const nom of noms) { await item(p, nom); await p.waitForTimeout(500); if (await debord(p)) ok(false, tag + ' : défilement horizontal dans « ' + nom + ' »'); await ferme(p); await p.waitForTimeout(250); }
  ok(!err.length, tag + ' : aucune erreur JavaScript' + (err.length ? ' : ' + err.slice(0, 3).join(' / ') : '')); await ctx.close(); }
/* 7. budgets simples, app téléphone (CPU normal) : ouvrir un espace, activité à l'arrêt, mémoire */
const budgets = async (nom, p, cdp, B) => {
  const t = await p.evaluate(async () => { const n = document.querySelector('.node'); const t0 = performance.now(); n.click(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); return Math.round(performance.now() - t0); });
  await p.waitForTimeout(400); await ferme(p); await p.waitForTimeout(800);
  await cdp.send('Performance.enable'); const m = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
  const a = await m(); await p.waitForTimeout(3000); const z = await m(); const ms = Math.round((z.TaskDuration - a.TaskDuration) * 1000 / 3), tas = Math.round(z.JSHeapUsedSize / 1048576);
  ok(t < B.ouvrir, nom + ' : budget « ouvrir un espace » (' + t + ' ms < ' + B.ouvrir + ')');
  ok(ms < B.repos, nom + ' : budget à l\'arrêt (' + ms + ' ms de tâches/s < ' + B.repos + ')');
  ok(tas < B.tas, nom + ' : budget mémoire JS (' + tas + ' Mo < ' + B.tas + ')'); };
{ const { ctx, p, cdp } = await ouvre(); await budgets('App téléphone', p, cdp, { ouvrir: 1500, repos: 40, tas: 80 }); await ctx.close(); }
/* 8. le carnet de recettes (module personnel seulement) */
{ const { ctx, p } = await ouvre(); const r = await p.evaluate(() => { const R = window._rec; if (!R) return null; return Object.keys(R.base).filter(n => { const a = R.analyse(n); return a.type !== 'base' || a.autres.length; }); });
  if (r) ok(!r.length, 'carnet de recettes : toutes reconnues' + (r.length ? ' (sauf ' + r.join(', ') + ')' : '')); else console.log('--  carnet de recettes : module personnel absent, contrôle sauté');
  await ctx.close(); }
/* ===== App ordinateur : souris, 1280 px ; la requête de l'app ordinateur est vraie, ses règles s'appliquent ===== */
console.log('\n== App ordinateur');
{ const { ctx, p, err, cdp } = await ouvre(null, 'clair', ORDI); const tag = 'App ordinateur';
  ok(await p.evaluate(() => matchMedia('(min-width:900px) and (pointer:fine)').matches && document.documentElement.classList.contains('ordi')), tag + ' : contexte souris réel (pointer:fine, classe « ordi »)');
  const n = await p.evaluate(() => document.querySelectorAll('.node').length); ok(n >= 4, tag + ' : la carte s\'affiche (' + n + ' items)');
  ok(!(await debord(p)), tag + ' : accueil sans défilement horizontal');
  /* chaque item s'ouvre au clic de la souris (vrai pointeur), sans défilement horizontal, et se ferme */
  const noms = await p.evaluate(() => [...document.querySelectorAll('.node b')].map(x => x.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean));
  let ouverts = 0; for (const nom of noms) { const c = await p.evaluate(nom => { const x = [...document.querySelectorAll('.node')].find(x => (x.querySelector('b') || {}).textContent?.replace(/\s+/g, ' ').trim() === nom); x.scrollIntoView({ block: 'center' }); const r = x.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, nom);
    await p.mouse.click(c[0], c[1]); await p.waitForTimeout(500); if (await p.evaluate(() => !document.getElementById('drawer').hidden)) ouverts++;
    if (await debord(p)) ok(false, tag + ' : défilement horizontal dans « ' + nom + ' »'); await ferme(p); await p.waitForTimeout(300); }
  ok(ouverts === noms.length, tag + ' : chaque item s\'ouvre au clic (' + ouverts + '/' + noms.length + ')');
  /* panneau d'espace : onglets de pages cliquables à la souris */
  await item(p, 'Lecture'); await p.waitForTimeout(500);
  const ong = await p.evaluate(() => [...document.querySelectorAll('#pane .rpt')].filter(x => x.offsetParent).length);
  if (ong >= 2) { const c = await p.evaluate(() => { const r = [...document.querySelectorAll('#pane .rpt')].filter(x => x.offsetParent)[1].getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }); await p.mouse.click(c[0], c[1]); await p.waitForTimeout(500); }
  ok(ong >= 2 && await sel(p) === 1, tag + ' : panneau d\'espace, onglet de page choisi à la souris (' + ong + ' onglets)');
  await ferme(p); await p.waitForTimeout(400);
  /* clavier : Tab atteint un item, avec un contour visible ; Entrée l'ouvre ; Échap le ferme */
  let foc = null; for (let i = 0; i < 40 && !foc; i++) { await p.keyboard.press('Tab'); foc = await p.evaluate(() => { const a = document.activeElement; return a && a.classList.contains('node') ? getComputedStyle(a).outlineStyle !== 'none' || getComputedStyle(a).boxShadow !== 'none' : null; }); }
  ok(foc === true, tag + ' : au clavier, Tab atteint un item, contour visible');
  await p.keyboard.press('Enter'); await p.waitForTimeout(600); const ouv = await p.evaluate(() => !document.getElementById('drawer').hidden);
  /* page plein écran : dialogue modal, carte en dessous inerte, focus dans la page */
  const dlg = await p.evaluate(() => { const d = document.getElementById('drawer'), w = document.querySelector('.wrap'); return d.getAttribute('role') === 'dialog' && d.getAttribute('aria-modal') === 'true' && !!d.getAttribute('aria-label') && w.inert && d.contains(document.activeElement) && !d.closest('[inert]'); });
  await p.keyboard.press('Escape'); await p.waitForTimeout(600); const ferm = await p.evaluate(() => document.getElementById('drawer').hidden);
  ok(ouv && ferm, tag + ' : au clavier, Entrée ouvre l\'item et Échap le ferme');
  ok(dlg, tag + ' : page ouverte = dialogue modal (role, aria-modal, nom), carte en dessous inerte, focus dans la page');
  ok(await p.evaluate(() => !document.querySelector('.wrap').inert && document.activeElement.classList.contains('node')), tag + ' : page fermée, la carte redevient active et le focus revient sur l\'item');
  ok(!err.length, tag + ' : aucune erreur JavaScript' + (err.length ? ' : ' + err.slice(0, 3).join(' / ') : ''));
  await csp(p, tag);
  await budgets(tag, p, cdp, { ouvrir: 800, repos: 25, tas: 80 });
  await ctx.close(); }
/* thème sombre, app ordinateur */
{ const { ctx, p, err } = await ouvre(null, 'sombre', ORDI);
  const noms = await p.evaluate(() => [...document.querySelectorAll('.node b')].map(x => x.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean));
  for (const nom of noms) { await item(p, nom); await p.waitForTimeout(400); if (await debord(p)) ok(false, 'App ordinateur sombre : défilement horizontal dans « ' + nom + ' »'); await ferme(p); await p.waitForTimeout(200); }
  ok(noms.length >= 4 && !err.length, 'App ordinateur, thème sombre : carte et items sans erreur' + (err.length ? ' : ' + err.slice(0, 3).join(' / ') : '')); await ctx.close(); }
console.log(ko ? ko + ' échec(s)' : 'Tout est bon.'); await b.close(); process.exit(ko ? 1 : 0);
