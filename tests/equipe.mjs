/* Tests de « Mes assistants » (l'équipe d'agents) et de « Moi dans 5 ans » (V.215), sur des données de démonstration neutres.
   Usage : python3 -m http.server 8767 (racine du dépôt), puis node tests/equipe.mjs. Le lien avec le système est simulé.
   Deux parties : « App téléphone » (412 px, tactile) puis « App ordinateur » (1280 px, souris). CAPTURES=dossier : captures. */
const { chromium, devices } = await import(process.env.PLAYWRIGHT || 'playwright');
const URL = (process.env.URL || 'http://localhost:8767/index.html') + '?test', CAP = process.env.CAPTURES;
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
let ko = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'KO  ') + m); if (!c) ko++; };
const j = n => { const q = new Date(); q.setDate(q.getDate() - n); return q.toISOString().slice(0, 10); };
const EQUIPE = { liste: [
  { id: 'veilleur', nom: 'Veilleur', groupe: 'Démo', statut: 'actif', role: 'Surveille un sujet de démonstration.', dernier: j(0) + ' 07:30',
    identite: { icone: 'loupe', couleur: '#ff0000', devise: 'Je regarde pour toi.', ton: 'calme' }, memoire: 'Tu préfères les synthèses courtes.',
    consignes: [{ id: 'c1', texte: 'Pas plus de trois pistes.', date: j(2) }],
    sorties: [{ id: 's1', date: j(0), titre: 'Trois pistes du jour', regarde: 'Dix sources.', trouve: 'Trois pistes.', propose: 'Lire la première.', attend: 'Ton avis.' },
      { id: 's2', date: j(1), titre: 'Rien à signaler' }] },
  { id: 'scribe', nom: 'Scribe', groupe: 'Démo', statut: 'actif', role: 'Écrit des brouillons.', identite: { icone: 'plume' },
    sorties: [{ id: 's3', date: j(30), titre: 'Un vieux brouillon', texte: 'Texte.' }] },
  { id: 'guide', nom: 'Guide', groupe: 'Démo', statut: 'specifie', role: 'Pas encore en service.', sorties: [] }] };
const TEL = Object.assign({}, devices['Galaxy S9+'], { viewport: { width: 412, height: 915 } }), ORDI = { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false };
for (const [nom, profil] of [['App téléphone', TEL], ['App ordinateur', ORDI]]) {
  console.log('— ' + nom);
  const ctx = await b.newContext(Object.assign({}, profil, { serviceWorkers: 'block', locale: 'fr-FR', timezoneId: 'Europe/Paris' }));
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('init')) { sessionStorage.setItem('init', '1'); localStorage.clear();
    ['hRap', 'compagnon', 'mouvements'].forEach(k => localStorage.setItem('test:' + k, '0')); ['compagnonChoisi', 'carte-de-vie-vu'].forEach(k => localStorage.setItem('test:' + k, '1'));
    localStorage.setItem('test:carte-de-vie-lien', 'cle-de-demo'); } });
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.goto(URL); await p.waitForTimeout(1500);
  /* sans le module personnel, le lien avec le système n'existe pas : le message est gardé, rien ne part */
  const sans = await p.evaluate(() => window.__equipe.CONV.envoie({ type: 'assistant' }));
  ok(!sans.ok && /pas activé/.test(sans.msg), nom + ' : sans lien avec le système, rien ne part (' + sans.msg + ')');
  /* ensuite, le lien est simulé (mêmes réponses que le système) */
  await p.evaluate(() => { window.__recu = []; window.__equipe.CONV.envoie = async c => { window.__recu.push(c.type);
    const R = { assistant: { ok: true, reponse: 'Réponse de démonstration.', consigne: { texte: 'Retenu.' } }, assistant_relance: { ok: true, reponse: 'Relancé.' },
      avis_assistant: { ok: true }, reunion: { ok: true, reponses: [{ id: 'veilleur', texte: 'Avis A.' }, { id: 'scribe', texte: 'Avis B.' }] },
      futur: { ok: true, reponse: 'Je te parle depuis plus tard.', lecture: { possibles: ['Un possible'], blocages: ['Un blocage'], pourrait_advenir: ['Une issue'] } } }[c.type];
    return R ? { ok: true, j: R } : { ok: false, bientot: true, msg: 'Bientôt disponible' }; }; });
  await p.evaluate(d => { const { ASSIST } = window.__equipe; ASSIST.charge(d); ASSIST.ouvre(); }, EQUIPE);
  const n = await p.locator('#assistPage .agposte').count(); ok(n === 3, nom + ' : les 3 assistants en icônes (' + n + ')');
  ok(await p.locator('#assistPage .agposte .agpas').first().textContent() === '1', nom + ' : pastille « 1 à lire » (la sortie « rien à signaler » ne compte pas)');
  const coul = await p.locator('#assistPage .agposte').first().evaluate(e => getComputedStyle(e).getPropertyValue('--ag').trim());
  ok(coul === '#002fa7', nom + ' : une couleur hors charte est remplacée par un bleu (' + coul + ')');
  if (CAP) await p.screenshot({ path: CAP + '/equipe-' + (profil === TEL ? 'tel' : 'ordi') + '.png' });
  await p.locator('#assistPage .agposte').first().click(); await p.waitForTimeout(200);
  ok(await p.locator('#agentPage').isVisible(), nom + ' : un clic sur l\'icône ouvre la page de l\'assistant');
  ok(await p.locator('#agentPage .agsortie').count() === 2, nom + ' : ses restitutions (2)');
  ok(/Ce que je te propose/.test(await p.locator('#agentPage .agsortie').first().textContent()), nom + ' : restitution en 4 parties');
  await p.locator('#agentPage .agav', { hasText: 'utile' }).first().click(); await p.waitForTimeout(300);
  ok((await p.evaluate(() => window.__recu)).includes('avis_assistant') && await p.locator('#agentPage .agav.on').count() === 1, nom + ' : avis « utile » transmis');
  if (CAP) await p.screenshot({ path: CAP + '/assistant-' + (profil === TEL ? 'tel' : 'ordi') + '.png' });
  await p.locator('#agentPage [role=tab]', { hasText: 'Lui parler' }).click();
  await p.fill('#agentPage .convf textarea', 'Bonjour'); await p.locator('#agentPage .convf button').click(); await p.waitForTimeout(400);
  ok(await p.locator('#agentPage .cvb.cvlui').count() === 1 && /Consigne retenue/.test(await p.locator('#agentPage .convetat').first().textContent()), nom + ' : discussion directe (réponse + consigne retenue)');
  await p.locator('#agentPage [role=tab]', { hasText: 'Ce qu\'il retient' }).click();
  ok(/synthèses courtes/.test(await p.locator('#agentPage').textContent()), nom + ' : ce qu\'il retient et tes consignes');
  await p.evaluate(() => window.__equipe.ASSIST.revue());
  ok(await p.locator('#agentPage .agsortie').count() === 1, nom + ' : revue de la semaine (1 restitution récente, sans « rien à signaler »)');
  await p.evaluate(() => { const { ASSIST } = window.__equipe; ASSIST.choisis = ['veilleur', 'scribe']; ASSIST.reunion(); });
  await p.fill('#agentPage .convf textarea', 'Une question'); await p.locator('#agentPage .convf button').click(); await p.waitForTimeout(400);
  ok(/Veilleur : Avis A/.test(await p.locator('#agentPage .cvb.cvlui').first().textContent()), nom + ' : réunion de deux assistants');
  /* Moi dans 5 ans : la boule d'Omni ouvre la page autonome (plus LIFE) */
  await p.evaluate(() => { document.querySelectorAll('aside.page').forEach(x => { x.hidden = true; }); window.__equipe.OMNI.futur().click(); });
  ok(await p.locator('#futurPage').isVisible() && !(await p.locator('#lifeP').isVisible().catch(() => false)), nom + ' : Moi dans 5 ans s\'ouvre dans la carte, pas dans LIFE');
  await p.fill('#futurPage .convf textarea', 'Qui es-tu ?'); await p.locator('#futurPage .convf button').click(); await p.waitForTimeout(400);
  ok(await p.locator('#futurPage .cvb.cvlui').count() === 1, nom + ' : conversation avec le moi futur');
  if (CAP) await p.screenshot({ path: CAP + '/futur-' + (profil === TEL ? 'tel' : 'ordi') + '.png' });
  await p.locator('#futurPage [role=tab]', { hasText: 'Ma lecture' }).click();
  ok(/Un blocage/.test(await p.locator('#futurPage').textContent()), nom + ' : lecture (possibles, blocages, ce qui pourrait advenir)');
  await p.locator('#futurPage .agchip', { hasText: "Moi d'il y a 5 ans" }).click();
  ok(/il y a 5 ans/.test(await p.locator('#futurPage h2').textContent()), nom + ' : moi d\'il y a 5 ans');
  await p.locator('#futurPage [role=tab]', { hasText: 'Capsule' }).click();
  ok(await p.locator('#futurPage .futcf').count() === 1, nom + ' : capsule à sceller');
  const larg = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1); ok(larg, nom + ' : aucun défilement horizontal');
  ok(!err.length, nom + ' : aucune erreur JavaScript' + (err.length ? ' : ' + err.slice(0, 2).join(' / ') : ''));
  await ctx.close();
}
await b.close();
console.log(ko ? ko + ' échec(s)' : 'Tout est vert'); process.exit(ko ? 1 : 0);
