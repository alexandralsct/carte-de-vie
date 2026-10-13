/* PWA de « Ma carte de vie », en deux parties : App téléphone puis App ordinateur (service worker réel, carte de démonstration).
   Usage : node tests/pwa.mjs (le test lance son propre petit serveur sur la racine du dépôt, qu'il arrête pour simuler le
   réseau coupé ; RACINE=… pour servir un autre dossier, par exemple une ancienne version)
   Vérifie : installation du service worker (fichiers vérifiés par empreinte) ; ouverture hors ligne ; une page piégée placée dans
   le cache par une autre page du site n'est jamais servie (audit de sécurité du 13/10, CC4) et la bonne copie revient en ligne ;
   l'ancien service worker de « life/ » ne supprime que le cache de l'ancienne LIFE (audit PWA, X1) ; manifeste complet. */
const { chromium, devices } = await import(process.env.PLAYWRIGHT || 'playwright');
import http from 'http';
import fs from 'fs';
import path from 'path';
const RACINE = process.env.RACINE || path.join(path.dirname(new globalThis.URL(import.meta.url).pathname), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.gz': 'application/gzip', '.wasm': 'application/wasm' };
let serveur = null, port = 0; const sockets = new Set();
const demarre = () => new Promise(ok => { serveur = http.createServer((q, r) => { const u = decodeURIComponent(new globalThis.URL(q.url, 'http://x').pathname); let f = path.join(RACINE, u.endsWith('/') ? u + 'index.html' : u);
    if (!f.startsWith(RACINE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(r); });
  serveur.on('connection', c => { sockets.add(c); c.on('close', () => sockets.delete(c)); }); serveur.listen(port, '127.0.0.1', () => { port = serveur.address().port; ok(); }); });
const arrete = () => new Promise(ok => { sockets.forEach(c => c.destroy()); serveur.close(() => ok()); });
await demarre(); const URL = 'http://localhost:' + port + '/index.html';
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
let ko = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'KO  ') + m); if (!c) ko++; };
const it = t => ({ id: Math.random().toString(36).slice(2, 13), text: t, done: false });
const DEMO = { 'espaces/jardin': { name: 'Jardin', groupe: 'Vie perso', color: '#3E95C9', prio: 2, x: 30, y: 30, rub: [], tasks: [it('Une tâche')], ideas: [], dates: [], links: [], log: [], _m: 1 },
  'espaces/lecture': { name: 'Lecture', groupe: 'Soi', color: '#7A4FD6', prio: 2, x: 60, y: 60, rub: [], tasks: [], ideas: [], dates: [], links: [], log: [], _m: 1 } };
const PROFILS = [['App téléphone', Object.assign({}, devices['Galaxy S9+'], { viewport: { width: 412, height: 915 } })],
  ['App ordinateur', { viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false }]];
/* manifeste */
{ const m = await (await fetch(new globalThis.URL('manifest.webmanifest', URL))).json();
  const manque = ['id', 'name', 'short_name', 'description', 'start_url', 'scope', 'display', 'background_color', 'theme_color', 'lang', 'icons'].filter(k => !m[k]);
  ok(!manque.length && m.icons.some(i => i.purpose === 'maskable') && (!m.share_target || m.share_target.enctype), 'manifeste complet (id, description, icône maskable, share_target avec enctype)' + (manque.length ? ' — manque : ' + manque.join(', ') : '')); }
for (const [nom, opt] of PROFILS) {
  console.log('\n== ' + nom);
  const ctx = await b.newContext(Object.assign({}, opt, { locale: 'fr-FR', timezoneId: 'Europe/Paris' }));
  await ctx.addInitScript(c => { try { if (localStorage.getItem('carte-de-vie-v1')) return; localStorage.setItem('carte-de-vie-v1', c); ['hRap', 'compagnon', 'mouvements'].forEach(k => localStorage.setItem(k, '0')); localStorage.setItem('carte-de-vie-vu', '1'); } catch { /* page d'erreur du navigateur */ } }, JSON.stringify(DEMO));
  /* réseau coupé pour la page ET pour le service worker (setOffline seul ne coupe pas toujours les requêtes du service worker) */
  const coupe = async on => { if (on) await arrete(); else await demarre(); };
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.goto(URL); await p.evaluate(() => navigator.serviceWorker.ready); await p.reload(); await p.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => {});
  const C = await p.evaluate(async () => { const k = (await caches.keys()).find(n => n.startsWith('carte-de-vie-v')); const c = await caches.open(k); return { k, n: (await c.keys()).length }; });
  ok(C.k && C.n >= 8, nom + ' : service worker installé, fichiers de l\'app vérifiés et gardés (' + C.k + ', ' + C.n + ' fichiers)');
  /* hors ligne */
  await coupe(true); await p.reload().catch(() => {}); await p.waitForFunction(() => document.querySelectorAll('.node').length >= 2, null, { timeout: 15000 }).catch(() => {});
  ok(await p.evaluate(() => document.querySelectorAll('.node').length >= 2), nom + ' : hors ligne, l\'app s\'ouvre avec ses espaces');
  /* cache empoisonné par une autre page du même site, puis réseau coupé */
  await coupe(false); await p.goto(new globalThis.URL('manifest.webmanifest', URL).href);
  await p.evaluate(async k => { const c = await caches.open(k); const piege = () => new Response('<!doctype html><title>piège</title><p id="piege">PAGE-PIEGEE</p>', { headers: { 'Content-Type': 'text/html' } });
    for (const u of ['./', './index.html']) await c.put(new globalThis.URL(u, location.href).href, piege()); await c.put(new globalThis.URL('monde.js', location.href).href, new Response('window.__piege=1', { headers: { 'Content-Type': 'text/javascript' } })); }, C.k);
  await coupe(true); const r = await p.goto(URL).catch(() => null); await p.waitForTimeout(800);
  const piege = await p.evaluate(() => /PAGE-PIEGEE/.test(document.body ? document.body.innerText : '') || !!window.__piege).catch(() => false);
  const vu = await p.evaluate(() => (document.body ? document.body.innerText : '').slice(0, 40)).catch(() => '');
  ok(!piege, nom + ' : hors ligne, une page piégée placée dans le cache n\'est jamais servie (' + (r ? 'réponse ' + r.status() + ' « ' + vu.replace(/\s+/g, ' ') + ' »' : 'page d\'erreur du navigateur') + ')');
  await coupe(false); await p.goto(URL); await p.waitForFunction(() => document.querySelectorAll('.node').length >= 2, null, { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(1500);
  const repare = await p.evaluate(async k => { const c = await caches.open(k), m = await c.match('./index.html'); const t = m ? await m.text() : ''; return !/PAGE-PIEGEE/.test(t) && t.length > 1e5; }, C.k);
  ok(repare, nom + ' : de retour en ligne, la vraie page est servie et la bonne copie remplace la page piégée');
  await coupe(true); await p.reload().catch(() => {}); await p.waitForFunction(() => document.querySelectorAll('.node').length >= 2, null, { timeout: 15000 }).catch(() => {});
  ok(await p.evaluate(() => document.querySelectorAll('.node').length >= 2 && !window.__piege), nom + ' : hors ligne ensuite, l\'app s\'ouvre de nouveau (copie réparée)');
  await coupe(false);
  /* ancien service worker de « life/ » (LIFE a déménagé) : il ne vide que le cache de l'ancienne LIFE */
  const L = await p.evaluate(async () => { await (await caches.open('life-V.0.0.30')).put('/x-life', new Response('nouvelle LIFE')); await (await caches.open('life-v1')).put('/x-old', new Response('ancienne LIFE'));
    const reg = await navigator.serviceWorker.register('life/sw.js', { scope: 'life/' }); await new Promise(r => setTimeout(r, 2500));
    const k = await caches.keys(), regs = (await navigator.serviceWorker.getRegistrations()).filter(x => /\/life\/$/.test(x.scope)).length; return { nouvelle: k.includes('life-V.0.0.30'), ancienne: k.includes('life-v1'), regs }; });
  ok(L.nouvelle && !L.ancienne && L.regs === 0, nom + ' : l\'ancien service worker de « life/ » garde le cache de la nouvelle LIFE, vide celui de l\'ancienne et s\'efface ' + JSON.stringify(L));
  ok(!err.length, nom + ' : aucune erreur JavaScript' + (err.length ? ' : ' + err.slice(0, 2).join(' / ') : ''));
  await ctx.close();
}
console.log(ko ? '\n' + ko + ' échec(s)' : '\nTout est bon.'); await b.close(); await arrete(); process.exit(ko ? 1 : 0);
