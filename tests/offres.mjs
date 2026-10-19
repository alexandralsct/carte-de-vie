/* Test du bouton « Oui » sur les offres d'emploi de « À valider » (rangées dans Travail > Annonces), sur des données de démonstration neutres.
   Usage : python3 -m http.server 8767 (racine du dépôt), puis node tests/offres.mjs. Rien n'est envoyé nulle part.
   Deux parties : « App téléphone » (412 px, tactile) puis « App ordinateur » (1280 px, souris). */
const { chromium, devices } = await import(process.env.PLAYWRIGHT || 'playwright');
const URL = (process.env.URL || 'http://localhost:8767/index.html') + '?test';
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
let ko = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'KO  ') + m); if (!c) ko++; };
const it = (t, done = false) => ({ id: Math.random().toString(36).slice(2, 13), text: t, done });
const esp = (name, x, y, rub, extra = {}) => Object.assign({ name, groupe: 'Revenus', color: '#3E95C9', prio: 2, x, y, rub, tasks: [], ideas: [], dates: [], links: [], log: [], _m: Date.now() }, extra);
const ev = (n, objet, source, type, lien) => ({ id: 'EV-' + n, type, source, objet, detail: 'score 7 · Site de démonstration · Ville A - 00 · CDI', lien: lien || '', quand: '2026-10-19 12:0' + n, qui: 'Démo', comment: '', pourquoi: '' });
const COCKPIT = { maj: '2026-10-19', a_relire: [], statuts: {}, sante: {}, alertes: [
  ev(1, 'Architecte de démonstration F/H', 'JOB', 'OFFRE_PERTINENTE', 'https://exemple.org/offre-1'), ev(2, 'Chargé de projet exemple F/H', 'JOB', 'OFFRE_PERTINENTE'),
  ev(3, 'Annonce de logement exemple', 'IMMO', 'ANNONCE_IMMO', 'https://exemple.org/logement') ] };
const base = rub => ({ 'espaces/travail': esp('Travail', 40, 40, rub), 'meta/cockpit': COCKPIT, 'meta/layout': { mx: 50, my: 50, sx: -1.5, sy: -900, _m: Date.now() } });
const RUB = [{ id: 'travail-r0', name: 'Candidatures', items: [it('Une candidature')] }, { id: 'travail-r1', name: 'Veille emploi', items: [] }];
const TEL = Object.assign({}, devices['Galaxy S9+'], { viewport: { width: 412, height: 915 } }), ORDI = { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false };
for (const [nom, profil] of [['App téléphone', TEL], ['App ordinateur', ORDI]]) {
  console.log('— ' + nom); const tel = profil === TEL;
  for (const cas of ['normal', 'sans-travail']) {
    const ctx = await b.newContext(Object.assign({}, profil, { serviceWorkers: 'block', locale: 'fr-FR', timezoneId: 'Europe/Paris' }));
    const carte = JSON.stringify(cas === 'normal' ? base(RUB) : Object.assign(base(RUB), { 'espaces/travail': undefined, 'espaces/autre': esp('Autre', 40, 40, [{ id: 'a1', name: 'Un', items: [] }]) }));
    await ctx.addInitScript(([c]) => { if (!sessionStorage.getItem('init')) { sessionStorage.setItem('init', '1'); localStorage.clear(); localStorage.setItem('test:carte-de-vie-v1', c);
      ['hRap', 'compagnon', 'mouvements'].forEach(k => localStorage.setItem('test:' + k, '0')); ['compagnonChoisi', 'carte-de-vie-vu'].forEach(k => localStorage.setItem('test:' + k, '1')); } }, [carte]);
    const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
    await p.goto(URL); await p.waitForTimeout(1800);
    const lis = () => p.evaluate(() => JSON.parse(localStorage.getItem('test:carte-de-vie-v1') || localStorage.getItem('carte-de-vie-v1')));
    await p.evaluate(() => window.__v227.ESSAI.ouvreVal()); await p.waitForTimeout(600);
    const carteOffres = () => p.locator('#valIn section.card', { hasText: "Offres d'emploi" });
    if (cas === 'normal') {
      ok(await carteOffres().locator('.vprop').count() === 2 && await carteOffres().locator('.offoui').count() === 2, nom + " : « Oui » sur chacune des 2 offres d'emploi");
      ok(await p.locator('#valIn .offoui').count() === 2, nom + " : pas de « Oui » sur les autres groupes (immobilier)");
      const un = carteOffres().locator('.vprop').first(), bt = await un.locator('.bact .btn').allTextContents();
      ok(['Je m\'en occupe', 'Non merci', 'Pas appropriée', 'Ouvrir'].every(t => bt.some(x => x.includes(t))), nom + ' : les actions existantes sont gardées (' + bt.join(' | ') + ')');
      const g = await un.locator('.offoui').evaluate(e => { const r = e.getBoundingClientRect(), c = e.parentElement.getBoundingClientRect(); return { h: r.height, w: r.width, pleine: r.width > c.width * 0.9 }; });
      if (tel) ok(g.h >= 48 && g.pleine, nom + ' : grand bouton tactile sur toute la largeur (' + JSON.stringify(g) + ')'); else ok(g.h <= 44 && g.w < 160, nom + ' : bouton compact à la souris (' + JSON.stringify(g) + ')');
      await carteOffres().locator('.vprop', { hasText: 'Architecte de démonstration' }).locator('.offoui').click(); await p.waitForTimeout(900);
      let d = await lis(), t = d['espaces/travail'], an = (t.rub || []).find(r => r.name === 'Annonces');
      ok(!!an && an.items.length === 1 && an.items[0].text === 'Architecte de démonstration F/H (https://exemple.org/offre-1)' && an.items[0].done === false && !!an.items[0].id && !!an.id, nom + ' : au premier Oui, la rubrique « Annonces » est créée avec l\'offre (intitulé + lien)');
      ok(t.rub.length === 3 && t.rub[0].items.length === 1, nom + ' : les autres rubriques ne sont pas touchées');
      ok(t._m > 0 && t._f && t._f.rub > 0, nom + ' : _m et _f.rub mis à jour');
      ok((d['meta/cockpit_masques'] || {}).ids && d['meta/cockpit_masques'].ids.length === 1, nom + ' : l\'offre est retirée de « À valider » (cockpit_masques)');
      ok(await carteOffres().locator('.vprop').count() === 1 && !/Architecte de démonstration/.test(await carteOffres().textContent()), nom + ' : elle disparaît de la liste');
      await carteOffres().locator('.vprop').first().locator('.offoui').click(); await p.waitForTimeout(900);
      d = await lis(); an = d['espaces/travail'].rub.filter(r => r.name === 'Annonces');
      ok(an.length === 1 && an[0].items.length === 2 && an[0].items[1].text === 'Chargé de projet exemple F/H', nom + ' : au second Oui, la même rubrique reçoit l\'offre (sans lien : intitulé seul), pas de doublon de rubrique');
      await p.reload(); await p.waitForTimeout(1800); await p.evaluate(() => window.__v227.ESSAI.ouvreVal()); await p.waitForTimeout(600);
      ok(await p.locator('#valIn .vprop b', { hasText: /Architecte de démonstration|Chargé de projet/ }).count() === 0 && await p.locator('#valIn .vprop b', { hasText: 'logement' }).count() === 1, nom + ' : après rechargement, les offres rangées ne reviennent pas');
    } else {
      await carteOffres().locator('.vprop').first().locator('.offoui').click(); await p.waitForTimeout(700);
      const d = await lis();
      ok(/Travail est introuvable/.test(await carteOffres().textContent()) && !((d['meta/cockpit_masques'] || {}).ids || []).length && await carteOffres().locator('.vprop').count() === 2, nom + ' : sans espace Travail, message clair, rien n\'est écrit ni retiré');
    }
    ok(err.length === 0, nom + ' (' + cas + ') : aucune erreur de page' + (err.length ? ' (' + err[0] + ')' : ''));
    await ctx.close();
  }
}
await b.close(); console.log(ko ? ko + ' échec(s)' : 'Tout est vert'); process.exit(ko ? 1 : 0);
