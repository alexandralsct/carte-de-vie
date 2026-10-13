/* Accessibilité de « Ma carte de vie » (WCAG 2.2 AA), en deux parties : App téléphone puis App ordinateur, thèmes clair et sombre.
   Usage : python3 -m http.server 8767 (à la racine du dépôt), puis node tests/accessibilite.mjs
   AXE=/chemin/axe.min.js : axe-core injecté sans réseau (sinon le paquet « axe-core » s'il est installé ; sinon les contrôles axe
   sont sautés, et le reste est vérifié quand même). Carte de démonstration neutre, aucune donnée réelle.
   Vérifie : titre de niveau 1 et zone principale à l'accueil ; axe sans violation sérieuse ou critique (accueil, page d'un espace) ;
   cibles d'au moins 24 px partout et de 44 px pour les commandes principales de l'app téléphone ; textes d'au moins 11 px ;
   focus rendu à l'élément d'origine quand on ferme un espace ; « moins de mouvement » sans animation sans fin. */
import fs from 'fs';
import { createRequire } from 'module';
const { chromium, devices } = await import(process.env.PLAYWRIGHT || 'playwright');
const URL = process.env.URL || 'http://localhost:8767/index.html';
let AXE = null; try { AXE = fs.readFileSync(process.env.AXE || createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8'); } catch { AXE = null; }
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
let ko = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'KO  ') + m); if (!c) ko++; };
const it = (t, done = false) => ({ id: Math.random().toString(36).slice(2, 13), text: t, done });
const esp = (name, groupe, color, x, y, rub) => ({ name, groupe, color, prio: 2, x, y, rub, tasks: [it('Une tâche de démonstration')], ideas: [it('Une idée')], dates: [], links: [], log: [], _m: Date.now() });
const DEMO = { 'espaces/jardin': esp('Jardin', 'Vie perso', '#3E95C9', 30, 30, [{ id: 'j1', name: 'À planter', items: [it('Tomates'), it('Basilic', true), it('Radis')] }, { id: 'j2', name: 'Carnet du jardin', journal: true, items: [] }]),
  'espaces/lecture': esp('Lecture', 'Soi', '#7A4FD6', 40, 65, [{ id: 'l1', name: 'À lire', items: [it('Un roman')] }, { id: 'l2', name: 'Livres lus', type: 'objectif', cible: 12, actuel: 3, unite: 'livres', pas: 1, items: [] }]),
  'espaces/sport': esp('Sport', 'Corps et santé', '#1F8A5B', 75, 70, [{ id: 'p1', name: 'Séances', items: [it('Course', true)] }]) };
const PROFILS = [['App téléphone', Object.assign({}, devices['Galaxy S9+'], { viewport: { width: 412, height: 915 } }), true],
  ['App ordinateur', { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false }, false]];
const ouvre = async (opt, theme, motion = 'no-preference') => { const ctx = await b.newContext(Object.assign({}, opt, { serviceWorkers: 'block', locale: 'fr-FR', timezoneId: 'Europe/Paris', reducedMotion: motion }));
  await ctx.addInitScript(([c, theme]) => { if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1'); localStorage.clear(); localStorage.setItem('carte-de-vie-v1', c); localStorage.setItem('carte-de-vie-vu', '1'); localStorage.setItem('hRap', '0'); localStorage.setItem('theme', theme); }, [JSON.stringify(DEMO), theme]);
  const p = await ctx.newPage(); await p.goto(URL); await p.waitForTimeout(2500); return { ctx, p }; };
const axe = async (p, cible) => { if (!AXE) return null; await p.evaluate(AXE); return p.evaluate(async c => (await axe.run(c ? document.querySelector(c) : document, { resultTypes: ['violations'], runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } }))
  .violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => v.id + ' ×' + v.nodes.length + ' (' + v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' ; ') + ')'), cible); };
/* cibles visibles et actives : taille de la boîte (WCAG 2.5.8 : 24 px, sauf texte en ligne) */
const cibles = p => p.evaluate(() => [...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,[role=button],[tabindex]:not([tabindex="-1"]),summary,label[for]')]
  .filter(e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && !e.closest('[hidden],[inert],[aria-hidden=true]') && !(e.tagName === 'A' && getComputedStyle(e).display === 'inline'); })
  .map(e => { const r = e.getBoundingClientRect(); return { m: Math.round(Math.min(r.width, r.height)), q: (e.id ? '#' + e.id : e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className ? '.' + e.className.split(' ')[0] : '')) + ' « ' + (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 20) + ' »' }; }));
const textes = p => p.evaluate(() => { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), t = []; let n;
  while ((n = w.nextNode())) { const s = n.textContent.trim(), e = n.parentElement; if (!s || !e || e.closest('[hidden],[aria-hidden=true],script,style,svg')) continue; const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    if (!r.width || r.bottom < 0 || r.top > innerHeight || cs.visibility === 'hidden' || cs.display === 'none') continue; const f = parseFloat(cs.fontSize); if (f < 11) t.push(f.toFixed(1) + ' px « ' + s.slice(0, 20) + ' »'); } return t; });
const espace = (p, nom) => p.evaluate(nom => { const x = [...document.querySelectorAll('.node')].find(x => (x.querySelector('b') || {}).textContent?.replace(/\s+/g, ' ').trim() === nom); if (x) { x.focus(); x.click(); } return !!x; }, nom);
for (const [nom, opt, tel] of PROFILS) {
  console.log('\n== ' + nom);
  for (const theme of ['clair', 'sombre']) {
    const { ctx, p } = await ouvre(opt, theme); const tag = nom + ', ' + theme;
    if (theme === 'clair') {
      const s = await p.evaluate(() => ({ h1: [...document.querySelectorAll('h1')].filter(h => h.getClientRects().length).length, main: document.querySelectorAll('main,[role=main]').length, h2: document.querySelectorAll('#board [role=heading][aria-level="2"]').length }));
      ok(s.h1 === 1 && s.main === 1 && s.h2 >= 1, tag + ' : accueil avec un titre de niveau 1, une zone principale et des titres de catégories (' + JSON.stringify(s) + ')');
      const c = await cibles(p), petites = c.filter(x => x.m < 24);
      ok(!petites.length, tag + ' : accueil, cibles d\'au moins 24 px (' + c.length + ' cibles)' + (petites.length ? ' — ' + petites.slice(0, 4).map(x => x.m + ' px ' + x.q).join(', ') : ''));
      if (tel) { const P = await p.evaluate(() => [...document.querySelectorAll('.top3a .btn, .v3add, .board .rgBtn, .node')].filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map(e => { const r = e.getBoundingClientRect(); return { m: Math.round(Math.min(r.width, r.height)), q: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 18) }; }));
        const sous = P.filter(x => x.m < 44); ok(P.length >= 4 && !sous.length, tag + ' : commandes principales d\'au moins 44 px (' + P.length + ')' + (sous.length ? ' — ' + sous.map(x => x.m + ' px ' + x.q).join(', ') : '')); }
      const t = await textes(p); ok(!t.length, tag + ' : accueil, textes d\'au moins 11 px' + (t.length ? ' — ' + t.slice(0, 4).join(', ') : ''));
    }
    const a = await axe(p); if (a) ok(!a.length, tag + ' : accueil, axe sans violation sérieuse' + (a.length ? ' — ' + a.join(' ; ') : '')); else if (theme === 'clair') console.log('--  axe-core absent : contrôles axe sautés (AXE=… ou npm i axe-core)');
    await espace(p, 'Jardin'); await p.waitForTimeout(1000);
    const a2 = await axe(p, '#drawer'); if (a2) ok(!a2.length, tag + ' : page d\'un espace, axe sans violation sérieuse' + (a2.length ? ' — ' + a2.join(' ; ') : ''));
    if (theme === 'clair') {
      const c = (await cibles(p)).filter(x => x.m < 24); ok(!c.length, tag + ' : page d\'un espace, cibles d\'au moins 24 px' + (c.length ? ' — ' + c.slice(0, 4).map(x => x.m + ' px ' + x.q).join(', ') : ''));
      const t = await textes(p); ok(!t.length, tag + ' : page d\'un espace, textes d\'au moins 11 px' + (t.length ? ' — ' + t.slice(0, 4).join(', ') : ''));
      await p.evaluate(() => document.getElementById('closeBtn').click()); await p.waitForTimeout(600);
      const f = await p.evaluate(() => { const e = document.activeElement; return !!e && e.classList.contains('node') && /Jardin/.test(e.textContent); });
      ok(f, tag + ' : espace fermé, le focus revient sur l\'espace qui l\'a ouvert');
    }
    await ctx.close();
  }
  /* « moins de mouvement » : aucune animation sans fin à l'accueil */
  { const { ctx, p } = await ouvre(opt, 'clair', 'reduce'); const n = await p.evaluate(() => document.getAnimations().filter(a => a.playState === 'running' && a.effect && a.effect.getTiming().iterations === Infinity).length);
    ok(n === 0, nom + ', moins de mouvement : aucune animation sans fin (' + n + ')'); await ctx.close(); }
}
console.log(ko ? '\n' + ko + ' échec(s)' : '\nTout est bon.'); await b.close(); process.exit(ko ? 1 : 0);
