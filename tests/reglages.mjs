/* Réglages (v232) : le bouton Réglages (trois petits points, comme LIFE) est visible et ouvre la page ; la page est rangée en cinq
   rubriques (Connexion en tête, puis Apparence), rien n'a disparu, chaque ligne déplacée fait toujours son travail.
   Usage : python3 -m http.server 8767 (racine du dépôt), puis node tests/reglages.mjs.
   Deux parties : « App téléphone » (412 px, tactile) puis « App ordinateur » (1280 px, souris). */
const { chromium, devices } = await import(process.env.PLAYWRIGHT || 'playwright');
const URL = process.env.URL || 'http://localhost:8767/index.html';
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
let ko = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'KO  ') + m); if (!c) ko++; };
const TEL = Object.assign({}, devices['Galaxy S9+'], { viewport: { width: 412, height: 915 } }), ORDI = { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false };
const AVANT = ['Typographie', 'Thème', 'Couleur des icônes', 'Icônes', 'Mes notes', 'Rappel des trackers', 'Compagnon', 'Mes icônes', "Fond de l'app", 'Mouvements', 'Notifications', 'Tout sur un écran', 'Ranger la carte', 'Synchronisation', 'Intelligence artificielle', 'Exporter', 'Importer', 'Effacer cet appareil', 'Donner mon avis', 'Modifier les réglages de base'];
const ORDRE = ['Connexion', 'Apparence', 'Au quotidien', 'Sauvegardes et appareil', 'Mon avis'];
for (const [nom, profil] of [['App téléphone', TEL], ['App ordinateur', ORDI]]) {
  console.log('— ' + nom);
  const tel = profil === TEL;
  const ctx = await b.newContext(Object.assign({}, profil, { serviceWorkers: 'block', locale: 'fr-FR', timezoneId: 'Europe/Paris' })), p = await ctx.newPage(), err = [];
  await ctx.addInitScript(() => { if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1'); localStorage.clear();
    ['hRap', 'compagnon', 'mouvements'].forEach(k => localStorage.setItem(k, '0')); ['compagnonChoisi', 'carte-de-vie-vu'].forEach(k => localStorage.setItem(k, '1')); });
  p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(URL); await p.waitForTimeout(1800);
  /* le bouton */
  const g = await p.evaluate(() => { const t = [...document.querySelectorAll('.top3a button')].find(x => x.getAttribute('aria-label') === 'Réglages'); if (!t) return null;
    const r = t.getBoundingClientRect(), e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { x: r.x, y: r.y, w: r.width, h: r.height, dessus: e === t || t.contains(e), pts: [...t.querySelectorAll('circle')].map(c => c.getAttribute('cx')).join(','), traits: t.querySelectorAll('path').length, titre: t.title, W: innerWidth }; });
  ok(g && g.w > 0 && g.dessus, nom + ' : le bouton Réglages est dans la barre du haut, visible et au premier plan');
  ok(g && g.pts === '5,12,19' && g.traits === 0, nom + " : son icône = trois petits points (comme LIFE), plus de soleil");
  ok(g && g.titre === 'Réglages' && g.y < 60 && g.x > g.W / 2, nom + ' : en haut à droite, avec son nom au toucher');
  ok(g && (tel ? g.w >= 44 && g.h >= 44 : g.w >= 36), nom + ' : zone de toucher suffisante (' + (g ? Math.round(g.w) + '×' + Math.round(g.h) : '?') + ' px)');
  await p.click('.top3a button[aria-label="Réglages"]'); await p.waitForTimeout(500);
  ok(await p.$eval('#setPage', e => !e.hidden), nom + ' : un clic ouvre les Réglages');
  /* la page */
  const gr = await p.$$eval('#setPage > .page-in > details.setgrp > summary > span', n => n.map(x => x.firstChild.textContent.trim()));
  ok(gr.join('|') === ORDRE.join('|'), nom + ' : cinq rubriques dans l’ordre : ' + gr.join(' · '));
  ok(await p.$eval('#setPage details.setgrp', d => d.open && d.querySelector('summary').textContent.startsWith('Connexion')), nom + ' : « Connexion » est en tête et déjà ouverte');
  ok(await p.$$eval('#setPage details.setgrp:not(#setConnexion)', n => n.every(d => !d.open)), nom + ' : les autres rubriques sont repliées');
  const rangees = await p.$$eval('#setPage details.setgrp', n => n.map(d => [d.querySelector('summary > span').firstChild.textContent.trim(), [...d.querySelectorAll('ul.setlist > li b')].map(x => x.textContent.trim())]));
  const tous = rangees.flatMap(r => r[1]);
  const perdus = AVANT.filter(t => !tous.includes(t));
  ok(perdus.length === 0, nom + ' : aucune des 20 lignes d’avant n’a disparu' + (perdus.length ? ' (manque : ' + perdus + ')' : ''));
  ok(tous.length === new Set(tous).size, nom + ' : pas de doublon');
  ok(!rangees.some(r => r[0] === 'Autres') && !(await p.$$('#setPage > .page-in > ul.setlist > li')).length, nom + ' : plus de rubrique « Autres » ni de ligne hors rubrique');
  ok(JSON.stringify(rangees.find(r => r[0] === 'Connexion')[1]) === JSON.stringify(['Connexion', 'Synchronisation', 'Intelligence artificielle']), nom + ' : Connexion = Connexion, synchronisation, IA');
  ok(JSON.stringify(rangees.find(r => r[0] === 'Apparence')[1].slice(0, 4)) === JSON.stringify(['Typographie', 'Thème', 'Couleur des icônes', 'Icônes']), nom + ' : Apparence commence par typographie, thème, couleurs, icônes');
  ok(await p.$$eval('#setPage summary .stico', n => n.length) === 5, nom + ' : une icône par rubrique');
  for (const id of ['typo', 'themeSet', 'kleinSet', 'icostyle', 'syncBtn', 'iaSet', 'expBtn', 'effBtn', 'avisBtn', 'baseBtn', 'arrBtn', 'pushBtn', 'motionSw', 'hRapSw']) if (!(await p.$('#' + id))) ok(false, nom + ' : élément #' + id + ' toujours présent');
  ok(true, nom + ' : les commandes (thème, icônes, synchro, IA, export, effacer, avis, ranger…) sont toujours là');
  /* les lignes déplacées font encore leur travail */
  await p.click('#cxBtn'); await p.waitForSelector('#cleDlg .cx', { timeout: 8000 });
  ok(await p.$eval('#cleDlg', d => d.open), nom + ' : « Connexion » ouvre l’écran Connexion');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.click('#syncBtn'); await p.waitForTimeout(400);
  ok(await p.$eval('#syncPage', e => !e.hidden), nom + ' : « Synchronisation » (déplacée) ouvre toujours sa page');
  ok(err.length === 0, nom + ' : aucune erreur de page' + (err.length ? ' : ' + err[0] : ''));
  await ctx.close();
}
await b.close(); process.exit(ko ? 1 : 0);
