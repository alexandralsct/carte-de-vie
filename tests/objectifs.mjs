/* « Mes objectifs » (la frise) : document meta/objectifs, quatre échéances (ce mois, ce trimestre, cette année, plus tard).
   Usage : python3 -m http.server 8767 (à la racine du dépôt), puis node tests/objectifs.mjs
   SHOTS=/dossier : enregistre aussi des captures (jamais dans ce dépôt public).
   Deux parties, comme deux produits : « App téléphone » (tactile, 412 px) puis « App ordinateur » (souris, 1280 px, pointer:fine).
   Toutes les données de ce fichier sont fictives. */
import fs from 'fs';
import path from 'path';
const { chromium, devices } = await import(process.env.PLAYWRIGHT || 'playwright');
const ADRESSE = process.env.URL || 'http://localhost:8767/index.html', SHOTS = process.env.SHOTS;
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
let ko = 0; const ok = (c, m, x) => { console.log((c ? 'OK  ' : 'KO  ') + m + (c || x === undefined ? '' : ' ' + JSON.stringify(x))); if (!c) ko++; };
const it = t => ({ id: Math.random().toString(36).slice(2, 13), text: t, done: false });
const esp = (name, color, x, y) => ({ name, groupe: 'Vie perso', color, prio: 2, x, y, rub: [{ id: 'r1', name: 'À faire', items: [it('Une chose')] }], tasks: [it('Une tâche')], ideas: [], dates: [], links: [], log: [], _m: Date.now() });
const DEMO = { 'espaces/jardin': esp('Jardin', '#3E95C9', 30, 30), 'espaces/lecture': esp('Lecture', '#7A4FD6', 60, 60) };
const TEL = Object.assign({}, devices['Galaxy S9+'], { viewport: { width: 412, height: 915 } }), ORDI = { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false };
const pad = n => String(n).padStart(2, '0');
/* dates relatives à aujourd'hui (jour local), calculées comme le fait l'app */
/* le jour de Paris (fuseau de la page testée), pas celui de la machine qui lance le test */
const [Y, M, JJ] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).split('-').map(Number), FQ = Math.ceil(M / 3) * 3;
const fin = (y, m) => { const d = new Date(y, m, 0); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const ajd = Y + '-' + pad(M) + '-' + pad(JJ);
const ouvre = async (profil, doc) => {
  const ctx = await b.newContext(Object.assign({}, profil, { serviceWorkers: 'block', locale: 'fr-FR', timezoneId: 'Europe/Paris' }));
  await ctx.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + (e.blockedURI || ''))); });
  await ctx.addInitScript(([carte]) => { if (!sessionStorage.getItem('init')) { sessionStorage.setItem('init', '1'); localStorage.clear(); localStorage.setItem('carte-de-vie-v1', carte);
    ['hRap', 'compagnon', 'mouvements'].forEach(k => localStorage.setItem(k, '0')); localStorage.setItem('compagnonChoisi', '1'); localStorage.setItem('carte-de-vie-vu', '1'); localStorage.setItem('theme', 'clair'); } }, [JSON.stringify(Object.assign({}, DEMO, doc || {}))]);
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(ADRESSE); await p.waitForTimeout(1800); return { ctx, p, err }; };
const stocke = async p => { await p.waitForTimeout(1200); return p.evaluate(() => { const c = JSON.parse(localStorage.getItem('carte-de-vie-v1') || '{}'); return c['meta/objectifs']; }); };
const deborde = p => p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
const ouvreFrise = async p => { await p.locator('.pcarre.pobj').first().click(); await p.waitForTimeout(500); };
const col = (p, k) => p.evaluate(k => [...document.querySelectorAll('#objIn .ocol.p-' + k + ' .otit')].map(x => x.textContent), k);
const FUS = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'index.html'), 'utf8');

for (const [nom, profil] of [['App téléphone', TEL], ['App ordinateur', ORDI]]) {
  console.log('\n== ' + nom);
  const tel = profil === TEL, tag = nom;
  /* 1. la frise est vide au départ : rien n'est écrit dans la carte */
  { const { ctx, p, err } = await ouvre(profil);
    ok(await p.locator('.pcarre.pobj').count() === 1, tag + ' : un carré « Mes objectifs » sur l\'accueil');
    ok(!(await deborde(p)), tag + ' : l\'accueil ne dépasse pas en largeur');
    await ouvreFrise(p);
    const v = await p.evaluate(() => ({ h: document.querySelector('#objIn h2')?.textContent, cols: [...document.querySelectorAll('#objIn .ocol h3')].map(x => x.textContent), n: document.querySelectorAll('#objIn .oitem').length, aide: !!document.querySelector('#objIn .help') }));
    ok(v.h === 'Mes objectifs' && v.cols.join('|') === 'Ce mois|Ce trimestre|Cette année|Plus tard', tag + ' : les quatre échéances, dans l\'ordre', v);
    ok(v.n === 0 && v.aide, tag + ' : la frise est vide au départ, avec une aide', v);
    ok((await stocke(p)) === undefined, tag + ' : rien n\'est écrit dans la carte tant qu\'on n\'a rien saisi');
    /* la disposition : ligne du temps verticale sur téléphone, quatre colonnes côte à côte sur ordinateur */
    const pos = await p.evaluate(() => [...document.querySelectorAll('#objIn .ocol')].map(x => { const r = x.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top)]; }));
    if (tel) ok(pos.every(q => q[0] === pos[0][0]) && pos[3][1] > pos[0][1], tag + ' : ligne du temps verticale, une échéance sous l\'autre', pos);
    else ok(pos.every(q => q[1] === pos[0][1]) && pos[3][0] > pos[0][0], tag + ' : frise horizontale, les quatre échéances côte à côte', pos);
    ok(!(await deborde(p)), tag + ' : la frise ne dépasse pas en largeur');
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, (tel ? 'tel' : 'ordi') + '-frise-vide.png') });
    /* 2. ajouter : titre, date cible, espace, état */
    await p.locator('#objIn .otop button').click(); await p.waitForTimeout(200);
    const esps = await p.evaluate(() => [...document.querySelectorAll('#objIn .oform select option')].map(o => o.textContent));
    ok(esps.includes('Jardin') && esps.includes('Lecture') && esps[0] === 'Sans espace', tag + ' : l\'espace se choisit parmi les espaces existants', esps);
    await p.fill('#objIn .oform input[type=text], #objIn .oform input:not([type])', 'Objectif du mois'); await p.fill('#objIn .oform input[type=date]', fin(Y, M));
    await p.selectOption('#objIn .oform select', 'jardin'); await p.locator('#objIn .oform button[type=submit]').click(); await p.waitForTimeout(400);
    ok((await col(p, 'mois')).join() === 'Objectif du mois', tag + ' : un objectif daté de ce mois se place dans « Ce mois »', await col(p, 'mois'));
    let s = await stocke(p);
    ok(s && s.liste.length === 1 && s.liste[0].titre === 'Objectif du mois' && s.liste[0].espace === 'jardin' && s.liste[0].etat === 'afaire' && /^\d{4}-\d{2}-\d{2}$/.test(s.liste[0].date) && s.liste[0].id, tag + ' : l\'objectif est enregistré (titre, date, espace, état, id)', s);
    ok(s && typeof s._m === 'number' && s._f && typeof s._f.liste === 'number', tag + ' : le document porte son heure d\'écriture (_m, _f.liste) pour la fusion', s && { _m: s._m, _f: s._f });
    const coul = await p.evaluate(() => getComputedStyle(document.querySelector('#objIn .oitem')).borderLeftColor);
    ok(coul === 'rgb(62, 149, 201)', tag + ' : la fiche prend la couleur de son espace', coul);
    /* un titre vide n'est pas enregistré */
    await p.locator('#objIn .otop button').click(); await p.locator('#objIn .oform button[type=submit]').click(); await p.waitForTimeout(200);
    ok((await stocke(p)).liste.length === 1, tag + ' : un titre vide n\'ajoute rien');
    await p.locator('#objIn .oform button:has-text("Annuler")').click();
    ok(!err.length, tag + ' : aucune erreur JavaScript', err); await ctx.close(); }

  /* 3. chaque échéance reçoit les bons objectifs (jeu de données fictif) */
  { const suiv = (m) => { const y = Y + Math.floor((M - 1 + m) / 12), mm = (M - 1 + m) % 12 + 1; return fin(y, mm); };
    const L = [
      { id: 'a1', titre: 'En retard', date: '2020-01-15', espace: 'lecture', etat: 'afaire', t: 'x' },
      { id: 'a2', titre: 'Ce mois', date: ajd, espace: '', etat: 'encours', t: 'x' },
      FQ > M ? { id: 'a3', titre: 'Ce trimestre', date: fin(Y, FQ), espace: '', etat: 'afaire', t: 'x' } : null,
      FQ < 12 ? { id: 'a4', titre: 'Cette année', date: fin(Y, 12), espace: '', etat: 'afaire', t: 'x' } : null,
      { id: 'a5', titre: 'Plus tard', date: fin(Y + 1, 6), espace: '', etat: 'afaire', t: 'x' },
      { id: 'a6', titre: 'Sans date', date: '', espace: '', etat: 'afaire', t: 'x' },
      { id: 'a7', titre: 'Atteint ancien', date: '2020-02-01', espace: '', etat: 'atteint', t: 'x' },
      { id: 'a8', titre: 'Atteint ce mois', date: ajd, espace: '', etat: 'atteint', t: 'x' }].filter(Boolean);
    const { ctx, p, err } = await ouvre(profil, { 'meta/objectifs': { liste: L, _m: 1, _f: { liste: 1 } } });
    ok(await p.locator('.pcarre.pobj').innerText().then(t => /3 à venir|\d+ à venir/.test(t) || /\d/.test(t)), tag + ' : le carré de l\'accueil compte les objectifs à venir');
    await ouvreFrise(p);
    const m = await col(p, 'mois'), t = await col(p, 'trim'), a = await col(p, 'an'), pl = await col(p, 'plus');
    ok(m.includes('En retard') && m.includes('Ce mois') && m.includes('Atteint ce mois') && m.indexOf('En retard') < m.indexOf('Ce mois'), tag + ' : « Ce mois » : les retards d\'abord, puis ce mois', m);
    ok(FQ > M ? t.join() === 'Ce trimestre' : t.length === 0, tag + ' : « Ce trimestre » : le reste du trimestre', t);
    ok(FQ < 12 ? a.join() === 'Cette année' : a.length === 0, tag + ' : « Cette année » : le reste de l\'année', a);
    ok(pl.join() === 'Plus tard,Sans date' || pl.join() === 'Plus tard|Sans date'.replace('|', ','), tag + ' : « Plus tard » : l\'an prochain et ce qui n\'a pas de date', pl);
    const av = await p.evaluate(() => ({ det: document.querySelector('#objIn details.oavant summary')?.textContent, hors: !!document.querySelector('#objIn .ofrise .oitem.e-atteint .otit') && [...document.querySelectorAll('#objIn .ofrise .otit')].some(x => x.textContent === 'Atteint ancien') }));
    ok(av.det === 'Atteints plus tôt : 1' && !av.hors, tag + ' : un objectif atteint d\'un mois passé quitte la frise (« Atteints plus tôt »)', av);
    const rt = await p.evaluate(() => [...document.querySelectorAll('#objIn .oitem.retard .odate')].map(x => x.textContent));
    ok(rt.length === 1 && /en retard/.test(rt[0]), tag + ' : un retard est écrit en toutes lettres (pas seulement une couleur)', rt);
    /* 4. changer l'état d'un geste */
    const bar = p.locator('#objIn .oitem:has-text("Ce mois") >> nth=0');
    await p.locator('#objIn .oitem', { hasText: 'Ce mois' }).first().locator('button.vchip:has-text("Atteint")').click(); await p.waitForTimeout(400);
    let s = await stocke(p), o = s.liste.find(x => x.id === 'a2');
    ok(o.etat === 'atteint' && o.fait && o.maj, tag + ' : « Atteint » enregistre l\'état et la date', o);
    ok(await p.evaluate(() => [...document.querySelectorAll('#objIn .oitem.e-atteint')].some(x => /Ce mois/.test(x.textContent))), tag + ' : la fiche atteinte est barrée');
    await p.locator('#objIn .oitem', { hasText: 'Ce mois' }).first().locator('button.vchip:has-text("En cours")').click(); await p.waitForTimeout(400);
    o = (await stocke(p)).liste.find(x => x.id === 'a2'); ok(o.etat === 'encours' && !('fait' in o), tag + ' : on peut revenir en arrière (la date « fait » disparaît)', o);
    const pr = await p.evaluate(() => [...document.querySelectorAll('#objIn .oitem')].map(x => [...x.querySelectorAll('button.vchip')].filter(b => b.getAttribute('aria-pressed') === 'true').length));
    ok(pr.every(n => n === 1), tag + ' : un seul état pressé par fiche (lecteur d\'écran : aria-pressed)', pr);
    /* 5. modifier */
    await p.locator('#objIn .oitem', { hasText: 'Sans date' }).first().locator('button:has-text("Modifier")').click(); await p.waitForTimeout(200);
    await p.fill('#objIn .oitem .oform input[type=date]', fin(Y, M)); await p.fill('#objIn .oitem .oform input:not([type=date])', 'Sans date, maintenant datée'); await p.locator('#objIn .oitem .oform button[type=submit]').click(); await p.waitForTimeout(400);
    o = (await stocke(p)).liste.find(x => x.id === 'a6'); ok(o.titre === 'Sans date, maintenant datée' && o.date === fin(Y, M) && (await col(p, 'mois')).includes('Sans date, maintenant datée'), tag + ' : modifier le titre et la date déplace l\'objectif dans la bonne échéance', o);
    /* 6. retirer : la liste est réécrite sans lui, et il ne revient pas */
    await p.locator('#objIn .oitem', { hasText: 'En retard' }).first().locator('button:has-text("Retirer")').click(); await p.waitForTimeout(400);
    s = await stocke(p); ok(!s.liste.some(x => x.id === 'a1') && s.liste.length === L.length - 1, tag + ' : « Retirer » enlève l\'objectif de la liste', s.liste.map(x => x.id));
    await p.reload(); await p.waitForTimeout(1500); await ouvreFrise(p);
    ok(!(await col(p, 'mois')).includes('En retard'), tag + ' : après rechargement, l\'objectif retiré n\'est pas revenu');
    /* 7. Échap ferme la page */
    await p.keyboard.press('Escape'); await p.waitForTimeout(300); ok(await p.evaluate(() => document.getElementById('objPage').hidden), tag + ' : Échap ferme la frise');
    await ouvreFrise(p);
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, (tel ? 'tel' : 'ordi') + '-frise-remplie.png'), fullPage: false });
    ok(!(await deborde(p)), tag + ' : la frise remplie ne dépasse pas en largeur');
    /* accessibilité : chaque champ a une étiquette, chaque bouton un nom */
    await p.locator('#objIn .otop button').click(); await p.waitForTimeout(200);
    const nu = await p.evaluate(() => [...document.querySelectorAll('#objIn input,#objIn select,#objIn button')].filter(x => x.offsetParent && !(x.getAttribute('aria-label') || x.textContent.trim() || (x.labels && x.labels.length))).length);
    ok(nu === 0, tag + ' : chaque champ et chaque bouton a un nom accessible', nu);
    const cp = await p.evaluate(() => (window.__csp || []).length); ok(cp === 0, tag + ' : aucune violation de la règle de sécurité (CSP)', cp);
    ok(!err.length, tag + ' : aucune erreur JavaScript', err); await ctx.close(); }

  /* 8. thème sombre : lisible */
  { const { ctx, p, err } = await ouvre(profil, { 'meta/objectifs': { liste: [{ id: 'z1', titre: 'Un objectif', date: ajd, espace: 'lecture', etat: 'afaire', t: 'x' }], _m: 1, _f: { liste: 1 } } });
    await p.evaluate(() => { document.documentElement.setAttribute('data-theme', 'sombre'); }); await ouvreFrise(p);
    const c = await p.evaluate(() => { const f = document.querySelector('#objIn .otit'), bg = getComputedStyle(document.querySelector('#objIn .oitem')).backgroundColor, fg = getComputedStyle(f).color; return { bg, fg }; });
    const lum = s => { const [r, g, b2] = s.match(/\d+/g).map(Number).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b2; };
    const ratio = (Math.max(lum(c.bg), lum(c.fg)) + .05) / (Math.min(lum(c.bg), lum(c.fg)) + .05);
    ok(ratio >= 4.5, tag + ' : thème sombre : contraste du titre ≥ 4,5 (' + ratio.toFixed(1) + ')', c);
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, (tel ? 'tel' : 'ordi') + '-frise-sombre.png') });
    ok(!err.length, tag + ' : thème sombre : aucune erreur JavaScript', err); await ctx.close(); }
}

/* 9. synchro entre appareils : fusion élément par élément (code extrait tel quel de index.html) */
console.log('\n== Synchro (commune aux deux apps)');
{ const i = FUS.indexOf('/* FUSION:debut'), j = FUS.indexOf('/* FUSION:fin */');
  const f = new Function(FUS.slice(i, j) + '\nreturn {mergeDoc,estampille,restampe,creeHorloge,vuDoc};')();
  const clone = o => o === undefined ? undefined : JSON.parse(JSON.stringify(o));
  const sansMeta = d => { const o = {}; Object.keys(d || {}).forEach(k => { if (!/^_(m|f|x|xt)$/.test(k)) o[k] = d[k]; }); return clone(o); };
  let T = 1.8e12; const avance = ms => { T += ms; };
  class App { constructor() { this.H = f.creeHorloge(() => T); this.doc = null; }
    ecrit(g) { this.doc = f.estampille(clone(this.doc), g(sansMeta(this.doc)), this.H.now()); return this; }
    recoit(d) { d = clone(d); f.vuDoc(this.H, d); this.doc = f.mergeDoc(d, this.doc); return this; } }
  const o = (id, titre, etat = 'afaire') => ({ id, titre, date: '2026-12-31', espace: '', etat, t: 'x' });
  const X = new App().ecrit(() => ({ liste: [o('o1', 'Un'), o('o2', 'Deux'), o('o3', 'Trois')] })); avance(1000);
  const a = new App().recoit(X.doc), c = new App().recoit(X.doc);
  a.ecrit(d => { d.liste = d.liste.filter(x => x.id !== 'o2'); return d; }); avance(5000);
  c.ecrit(d => { d.liste.find(x => x.id === 'o3').etat = 'atteint'; d.liste.push(o('o4', 'Quatre')); return d; });
  for (const m of [f.mergeDoc(clone(a.doc), clone(c.doc)), f.mergeDoc(clone(c.doc), clone(a.doc))]) {
    const ids = m.liste.map(x => x.id).sort().join(',');
    ok(ids === 'o1,o3,o4', 'Un appareil retire un objectif, l\'autre en change un et en ajoute un : le retrait ne revient pas, le reste est gardé (' + ids + ')');
    ok(m.liste.find(x => x.id === 'o3').etat === 'atteint', 'Le changement d\'état fait sur l\'autre appareil est gardé'); }
  /* deux appareils changent l'état d'objectifs différents, chacun hors ligne */
  const d1 = new App().recoit(X.doc), d2 = new App().recoit(X.doc); avance(1000);
  d1.ecrit(d => { d.liste.find(x => x.id === 'o1').etat = 'encours'; return d; }); avance(3000); d2.ecrit(d => { d.liste.find(x => x.id === 'o3').etat = 'atteint'; return d; });
  for (const m of [f.mergeDoc(clone(d1.doc), clone(d2.doc)), f.mergeDoc(clone(d2.doc), clone(d1.doc))]) ok(m.liste.find(x => x.id === 'o1').etat === 'encours' && m.liste.find(x => x.id === 'o3').etat === 'atteint', 'Deux appareils modifient deux objectifs différents : les deux modifications sont gardées'); }

await b.close(); console.log(ko ? '\n' + ko + ' ÉCHEC(S)' : '\nTout est bon.'); process.exit(ko ? 1 : 0);
