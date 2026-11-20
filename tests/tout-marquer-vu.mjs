/* Test du bouton « Tout marquer vu » par type d'alerte, dans le tiroir du cockpit, sur des données de démonstration neutres.
   Usage : python3 -m http.server 8767 (racine du dépôt), puis node tests/tout-marquer-vu.mjs. Rien n'est envoyé nulle part.
   Deux parties : « App téléphone » (412 px, tactile) puis « App ordinateur » (1280 px, souris). */
const { chromium, devices } = await import(process.env.PLAYWRIGHT || 'playwright');
const URL = (process.env.URL || 'http://localhost:8767/index.html') + '?test';
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
let ko = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'KO  ') + m); if (!c) ko++; };
const ev = (n, objet, source, type) => ({ id: 'EV-' + n, type, source, objet, detail: 'Donnée de démonstration', lien: '', quand: '2026-10-19 12:0' + n, qui: 'Démo', comment: '', pourquoi: '' });
const COCKPIT = { maj: '2026-10-19', a_relire: [], statuts: {}, sante: {}, alertes: [
  ev(1, 'Architecte de démonstration F/H', 'JOB', 'OFFRE_PERTINENTE'), ev(2, 'Chargé de projet exemple F/H', 'JOB', 'OFFRE_PERTINENTE'),
  ev(3, 'Annonce de logement exemple', 'IMMO', 'ANNONCE_IMMO') ] };
const ESP = { name: 'Vie', groupe: 'Revenus', color: '#3E95C9', prio: 2, x: 40, y: 40, rub: [], tasks: [], ideas: [], dates: [], links: [], log: [], forme: 'bulle', ass: ['LIFE'], _m: Date.now() };
const base = () => ({ 'espaces/vie': ESP, 'meta/cockpit': COCKPIT, 'meta/layout': { mx: 50, my: 50, sx: -1.5, sy: -900, _m: Date.now() } });
const TEL = Object.assign({}, devices['Galaxy S9+'], { viewport: { width: 412, height: 915 } }), ORDI = { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false };
for (const [nom, profil] of [['App téléphone', TEL], ['App ordinateur', ORDI]]) {
  console.log('— ' + nom); const tel = profil === TEL;
  for (const reponse of [true, false]) {
    const ctx = await b.newContext(Object.assign({}, profil, { serviceWorkers: 'block', locale: 'fr-FR', timezoneId: 'Europe/Paris' }));
    const carte = JSON.stringify(base());
    await ctx.addInitScript(([c]) => { if (!sessionStorage.getItem('init')) { sessionStorage.setItem('init', '1'); localStorage.clear(); localStorage.setItem('test:carte-de-vie-v1', c);
      ['hRap', 'compagnon', 'mouvements'].forEach(k => localStorage.setItem('test:' + k, '0')); ['compagnonChoisi', 'carte-de-vie-vu'].forEach(k => localStorage.setItem('test:' + k, '1')); } }, [carte]);
    const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
    const dialogues = []; p.on('dialog', d => { dialogues.push(d.message()); reponse ? d.accept() : d.dismiss(); });
    await p.goto(URL); await p.waitForTimeout(1800);
    const lis = () => p.evaluate(() => JSON.parse(localStorage.getItem('test:carte-de-vie-v1') || localStorage.getItem('carte-de-vie-v1')));
    const masques = async () => ((await lis())['meta/cockpit_masques'] || {}).ids || [];
    const ouvreVie = async () => { await p.waitForTimeout(400); await p.locator('.node', { hasText: 'Vie' }).first().evaluate(e => e.click()); await p.waitForTimeout(700); };
    const boutons = () => p.locator('section.cockpit button', { hasText: 'Tout marquer vu' });
    await ouvreVie();
    if (reponse) {
      ok(await boutons().count() === 2, nom + " : un bouton par type d'alerte (2 types)");
      const txt = await boutons().allTextContents();
      ok(txt.some(t => t.includes('OFFRE_PERTINENTE (2)')) && txt.some(t => t.includes('ANNONCE_IMMO (1)')), nom + ' : les boutons indiquent le type et le nombre (' + txt.join(' | ') + ')');
      const g = await boutons().first().evaluate(e => { const r = e.getBoundingClientRect(); return { h: r.height, w: r.width }; });
      ok(tel ? g.h >= 40 : g.h <= 44, nom + ' : taille du bouton adaptée au profil (' + JSON.stringify(g) + ')');
      await boutons().filter({ hasText: 'OFFRE_PERTINENTE' }).click(); await p.waitForTimeout(900);
      ok(dialogues.length === 1 && /Marquer les 2 alertes « OFFRE_PERTINENTE » comme vues \?/.test(dialogues[0]), nom + ' : confirmation demandée (' + (dialogues[0] || '') + ')');
      const ids = await masques();
      ok(ids.length === 2 && ids.every(k => k.startsWith('OFFRE_PERTINENTE|')), nom + ' : les 2 clés sont ajoutées à meta/cockpit_masques');
      ok(await boutons().count() === 1 && !/Architecte de démonstration|Chargé de projet/.test(await p.locator('.ckbloc').allTextContents().then(x => x.join(' '))), nom + ' : les 2 offres disparaissent du tiroir, l\'annonce reste');
      await p.reload(); await ouvreVie();
      ok(await boutons().count() === 1 && (await masques()).length === 2, nom + ' : après rechargement, les offres masquées ne reviennent pas');
    } else {
      await boutons().filter({ hasText: 'OFFRE_PERTINENTE' }).click(); await p.waitForTimeout(700);
      ok(dialogues.length === 1 && (await masques()).length === 0 && await boutons().count() === 2, nom + ' : refus de la confirmation, rien n\'est marqué vu');
    }
    ok(err.length === 0, nom + ' (' + (reponse ? 'confirmé' : 'refusé') + ') : aucune erreur de page' + (err.length ? ' (' + err[0] + ')' : ''));
    await ctx.close();
  }
}
await b.close(); console.log(ko ? ko + ' échec(s)' : 'Tout est vert'); process.exit(ko ? 1 : 0);
