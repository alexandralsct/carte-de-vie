/* Mesures de performance de « Ma carte de vie », en deux parties : App téléphone puis App ordinateur.
   Usage : python3 -m http.server 8767 (à la racine du dépôt), puis node tests/mesures.mjs
   Carte de démonstration neutre (aucune donnée réelle). CARTE=/chemin/sauvegarde.json : mesure en plus sur une sauvegarde locale
   (jamais commitée). BUDGETS=0 : affiche sans faire échouer. COURT=1 : sans la mesure après 30 s d'inactivité.
   Mesures :
   - démarrage : FCP, DOMContentLoaded, TBT (somme des longues tâches au-delà de 50 ms), plus longue tâche et sauts de mise en
     page (CLS, budget < 0,1) ; aussi avec une grande carte fictive d'environ 1 Mo ouverte pour la première fois (positions pas
     encore rangées : c'est là que la carte se rangeait en redessinant tout à chaque espace) ;
   - à l'arrêt, compagnon allumé : temps de tâches (ms par seconde) et mises en page par seconde, juste après l'ouverture
     puis après 30 s sans toucher l'écran (le compagnon doit s'être mis en pause) ;
   - réglages par défaut : idem (sur l'app téléphone, le compagnon est éteint par défaut) ;
   - « moins de mouvement » (prefers-reduced-motion) : compagnon éteint par défaut, immobile s'il est rallumé. */
import fs from 'fs';
const { chromium, devices } = await import(process.env.PLAYWRIGHT || 'playwright');
const URL = process.env.URL || 'http://localhost:8767/index.html', BUDG = process.env.BUDGETS !== '0', COURT = !!process.env.COURT;
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
let ko = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : (BUDG ? 'KO  ' : '!!  ')) + m); if (!c && BUDG) ko++; };
const it = t => ({ id: Math.random().toString(36).slice(2, 13), text: t, done: false });
const DEMO = {};
for (let i = 0; i < 12; i++) DEMO['espaces/demo' + i] = { name: 'Espace ' + (i + 1), groupe: ['Soi', 'Revenus', 'Patrimoine', 'Vie perso', 'Corps et santé'][i % 5], color: '#3E95C9', prio: 2, x: 10 + (i * 7) % 80, y: 10 + (i * 13) % 80,
  rub: [{ id: 'r' + i, name: 'Rubrique', items: Array.from({ length: 8 }, (_, k) => it('Élément ' + k)) }], tasks: [it('Une tâche')], ideas: [it('Une idée')], dates: [], links: [], log: [], _m: Date.now() };
/* grande carte fictive (~1 Mo, textes neutres générés), sans positions enregistrées */
const GRANDE = {}; { const g = ['Soi', 'Revenus', 'Patrimoine', 'Vie perso', 'Corps et santé'];
  for (let i = 0; i < 22; i++) GRANDE['espaces/grand' + i] = { name: 'Espace ' + (i + 1), groupe: g[i % 5], color: '#3E95C9', prio: 2,
    rub: Array.from({ length: 4 }, (_, r) => ({ id: 'g' + i + 'r' + r, name: 'Rubrique ' + (r + 1), items: Array.from({ length: 60 }, (_, k) => ({ id: 'g' + i + 'r' + r + 'i' + k, text: 'Élément de démonstration numéro ' + k + ' avec un texte neutre de longueur moyenne pour simuler une vraie liste', done: k % 5 === 0 })) })),
    tasks: Array.from({ length: 30 }, (_, k) => it('Tâche de démonstration ' + k)), ideas: Array.from({ length: 30 }, (_, k) => it('Idée de démonstration ' + k)), dates: [], links: [],
    log: Array.from({ length: 200 }, (_, k) => ({ t: new Date(Date.now() - k * 36e5).toISOString(), m: 'Entrée de journal de démonstration ' + k })), _m: Date.now() }; }
const CARTES = [['démo', JSON.stringify(DEMO)], ['grande carte (' + Math.round(JSON.stringify(GRANDE).length / 1e4) / 100 + ' Mo, 1re ouverture)', JSON.stringify(GRANDE)]]; if (process.env.CARTE) CARTES.push(['sauvegarde locale', fs.readFileSync(process.env.CARTE, 'utf8')]);
const PROFILS = [
  ['App téléphone', Object.assign({}, devices['Galaxy S9+'], { viewport: { width: 412, height: 915 } }), 4],
  ['App ordinateur', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false }, 1]];
const ouvre = async (opt, cpu, carte, reglages) => {
  const ctx = await b.newContext(Object.assign({}, opt, { serviceWorkers: 'block', locale: 'fr-FR', timezoneId: 'Europe/Paris' }));
  await ctx.addInitScript(([carte, reglages]) => { if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1'); localStorage.clear(); localStorage.setItem('carte-de-vie-v1', carte); localStorage.setItem('carte-de-vie-vu', '1'); localStorage.setItem('hRap', '0');
    for (const [k, v] of Object.entries(reglages)) localStorage.setItem(k, v);
    window.__lt = []; try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push(e.duration))).observe({ type: 'longtask', buffered: true }); } catch (_) {}
    window.__cls = 0; try { new PerformanceObserver(l => l.getEntries().forEach(e => { if (!e.hadRecentInput) window.__cls += e.value; })).observe({ type: 'layout-shift', buffered: true }); } catch (_) {} }, [carte, reglages]);
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p); await cdp.send('Performance.enable'); if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  const err = []; p.on('pageerror', e => err.push(e.message));
  await p.goto(URL, { waitUntil: 'load' }); return { ctx, p, cdp, err }; };
const metr = async cdp => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
const repos = async (p, cdp, s) => { const a = await metr(cdp); await p.waitForTimeout(s * 1000); const z = await metr(cdp); return { ms: Math.round((z.TaskDuration - a.TaskDuration) * 1000 / s), lay: Math.round((z.LayoutCount - a.LayoutCount) / s) }; };
const res = {};
for (const [nom, opt, cpu] of PROFILS) {
  console.log('\n== ' + nom + (cpu > 1 ? ' (CPU ×' + cpu + ')' : ''));
  { const { ctx, p } = await ouvre(opt, cpu, CARTES[0][1], {}); await p.waitForTimeout(1500); await ctx.close(); } /* chauffe : la première ouverture compile le code, elle n'est pas comptée */
  for (const [cn, carte] of CARTES) {
    /* démarrage (compagnon et mouvements selon les réglages par défaut) */
    { const { ctx, p, cdp, err } = await ouvre(opt, cpu, carte, {}); await p.waitForTimeout(cn === 'démo' ? 3000 : 8000);
      const d = await p.evaluate(() => { const n = performance.getEntriesByType('navigation')[0], f = performance.getEntriesByName('first-contentful-paint')[0];
        return { fcp: Math.round(f ? f.startTime : 0), dcl: Math.round(n.domContentLoadedEventEnd), tbt: Math.round(window.__lt.reduce((s, x) => s + Math.max(0, x - 50), 0)), max: Math.round(Math.max(0, ...window.__lt)), cls: +window.__cls.toFixed(3), cpn: !document.querySelector('.cpn') || !document.querySelector('.cpn').hidden }; });
      console.log('   [' + cn + '] démarrage : FCP ' + d.fcp + ' ms · DOMContentLoaded ' + d.dcl + ' ms · TBT ' + d.tbt + ' ms · plus longue tâche ' + d.max + ' ms · CLS ' + d.cls + ' · compagnon ' + (d.cpn ? 'visible' : 'éteint') + ' par défaut');
      const r = await repos(p, cdp, 5); console.log('   [' + cn + '] à l\'arrêt, réglages par défaut : ' + r.ms + ' ms de tâches/s · ' + r.lay + ' mises en page/s');
      res[nom + cn + 'def'] = r; res[nom + cn + 'dem'] = d; if (cn === 'démo') ok(!err.length, nom + ' : aucune erreur JavaScript' + (err.length ? ' : ' + err.slice(0, 2).join(' / ') : ''));
      if (cn === 'démo' && nom === 'App téléphone') ok(!d.cpn, nom + ' : compagnon éteint par défaut');
      if (cn === 'démo') ok(d.tbt < (cpu > 1 ? 1500 : 400), nom + ' : budget TBT au démarrage (' + d.tbt + ' ms < ' + (cpu > 1 ? 1500 : 400) + ')');
      if (cn.startsWith('grande')) ok(d.tbt < (cpu > 1 ? 2500 : 600) && d.max < (cpu > 1 ? 1500 : 400), nom + ' : grande carte à la 1re ouverture, sans cascade de redessins (TBT ' + d.tbt + ' ms < ' + (cpu > 1 ? 2500 : 600) + ', plus longue tâche ' + d.max + ' ms < ' + (cpu > 1 ? 1500 : 400) + ')');
      if (cn !== 'sauvegarde locale') ok(d.cls < 0.1, nom + ' [' + cn + '] : budget CLS au démarrage (' + d.cls + ' < 0,1)');
      await ctx.close(); }
    /* compagnon allumé, mouvements allumés */
    if (!cn.startsWith('grande')) { const { ctx, p, cdp } = await ouvre(opt, cpu, carte, { compagnon: '1', compagnonChoisi: '1', mouvements: '1' }); await p.waitForTimeout(3000);
      const r1 = await repos(p, cdp, 5); console.log('   [' + cn + '] compagnon allumé, 3 à 8 s après l\'ouverture : ' + r1.ms + ' ms de tâches/s · ' + r1.lay + ' mises en page/s');
      if (!COURT) { await p.waitForTimeout(24000); const r2 = await repos(p, cdp, 5); console.log('   [' + cn + '] compagnon allumé, après 30 s sans toucher : ' + r2.ms + ' ms de tâches/s · ' + r2.lay + ' mises en page/s');
        if (cn === 'démo') ok(r2.ms < 40, nom + ' : compagnon en pause après 30 s sans toucher (' + r2.ms + ' ms/s < 40)'); res[nom + cn + 'pause'] = r2; }
      res[nom + cn + 'cpn'] = r1; await ctx.close(); }
  }
}
/* « moins de mouvement » demandé par le système (prefers-reduced-motion) : compagnon éteint par défaut ; rallumé par la personne,
   il reste immobile (aucune animation, aucune promenade) */
for (const [nom, opt] of PROFILS.map(([n, o]) => [n, Object.assign({}, o, { reducedMotion: 'reduce' })])) {
  { const { ctx, p } = await ouvre(opt, 1, CARTES[0][1], {}); await p.waitForTimeout(2500);
    ok(await p.evaluate(() => { const c = document.querySelector('.cpn'); return !c || c.hidden; }), nom + ', moins de mouvement : compagnon éteint par défaut'); await ctx.close(); }
  { const { ctx, p, cdp } = await ouvre(opt, 1, CARTES[0][1], { compagnon: '1', compagnonChoisi: '1', mouvements: '1' }); await p.waitForTimeout(2500);
    const n = await p.evaluate(() => { const c = document.querySelector('.cpn'); return c && !c.hidden ? c.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length : -1; });
    const r = await repos(p, cdp, 3); ok(n === 0 && r.lay < 5, nom + ', moins de mouvement, compagnon rallumé : immobile (' + n + ' animation, ' + r.ms + ' ms de tâches/s, ' + r.lay + ' mises en page/s)'); await ctx.close(); }
}
/* budget de taille */
{ const r = await fetch(URL); const t = await r.text(); ok(t.length < 1.3e6, 'index.html : ' + Math.round(t.length / 1024) + ' Ko (< 1 300 Ko)'); }
if (process.env.JSON_OUT) fs.writeFileSync(process.env.JSON_OUT, JSON.stringify(res, null, 1));
console.log(ko ? '\n' + ko + ' budget(s) dépassé(s)' : '\nBudgets respectés.'); await b.close(); process.exit(ko ? 1 : 0);
