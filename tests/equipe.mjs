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
    identite: { icone: 'loupe', couleur: '#ff0000', devise: 'Je regarde pour toi.', ton: 'calme', image: 'avatars/demo.jpg' }, memoire: 'Tu préfères les synthèses courtes.',
    consignes: [{ id: 'c1', texte: 'Pas plus de trois pistes.', date: j(2) }],
    sorties: [{ id: 's1', date: j(0), titre: 'Trois pistes du jour', regarde: 'Dix sources.', trouve: 'Trois pistes.', propose: 'Lire la première.', attend: 'Ton avis.' },
      { id: 's2', date: j(1), titre: 'Rien à signaler' }] },
  { id: 'scribe', nom: 'Scribe', groupe: 'Démo', statut: 'actif', role: 'Écrit des brouillons.', identite: { icone: 'plume', image: '../hors-dossier.jpg' },
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
  /* avatars illustrés (V.218) : image lue dans le dépôt des compléments (simulée ici par une image fictive générée), seulement pour
     un chemin « avatars/… » ; les autres gardent leur dessin */
  await p.evaluate(() => { window.__imgs = []; window.__equipe.AGIMG.lire = () => async c => { window.__imgs.push(c); const k = document.createElement('canvas'); k.width = 100; k.height = 198;
    const g = k.getContext('2d'); g.fillStyle = '#002fa7'; g.fillRect(0, 0, 100, 198); return k.toDataURL('image/png'); }; window.__equipe.ASSIST.ouvre(); });
  await p.waitForSelector('#assistPage .agportrait .agimg', { timeout: 3000 }).catch(() => {});
  const imgs = await p.evaluate(() => ({ demandes: window.__imgs, vues: document.querySelectorAll('#assistPage .agimg').length, dessins: document.querySelectorAll('#assistPage .agava').length }));
  ok(imgs.vues === 1 && imgs.demandes.every(c => c === 'perso/avatars/demo.jpg'), nom + ' : avatar illustré affiché pour l\'assistant qui en a un, chemin contrôlé (' + JSON.stringify(imgs) + ')');
  ok(imgs.dessins >= 2, nom + ' : les autres gardent leur dessin (' + imgs.dessins + ')');
  const n = await p.locator('#assistPage .agposte').count(); ok(n === 3, nom + ' : les 3 assistants en icônes (' + n + ')');
  ok(await p.locator('#assistPage .agposte .agpas').first().textContent() === '1', nom + ' : pastille « 1 à lire » (la sortie « rien à signaler » ne compte pas)');
  const coul = await p.locator('#assistPage .agposte').first().evaluate(e => getComputedStyle(e).getPropertyValue('--ag').trim());
  ok(coul === '#002fa7', nom + ' : une couleur hors charte est remplacée par un bleu (' + coul + ')');
  if (CAP) await p.screenshot({ path: CAP + '/equipe-' + (profil === TEL ? 'tel' : 'ordi') + '.png' });
  await p.locator('#assistPage .agposte').first().click(); await p.waitForTimeout(200);
  ok(await p.locator('#agentPage').isVisible(), nom + ' : un clic sur l\'icône ouvre la page de l\'assistant');
  ok(await p.locator('#agentPage .agsortie').count() === 2, nom + ' : ses restitutions (2)');
  /* balayer une remarque pour la masquer (V.218, app téléphone) : glissement simulé au doigt, puis « Annuler » */
  if (nom === 'App téléphone') {
    const bal = async () => p.evaluate(async () => { const c = document.querySelector('#agentPage .agsortie.agbalaie'); if (!c) return 'pas de carte balayable';
      const r = c.getBoundingClientRect(), y = r.top + 20, ev = (t, x) => c.dispatchEvent(new PointerEvent(t, { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: true }));
      ev('pointerdown', r.left + 30); for (let i = 1; i <= 10; i++) ev('pointermove', r.left + 30 + i * r.width * 0.06); ev('pointerup', r.left + 30 + r.width * 0.6);
      await new Promise(f => setTimeout(f, 450)); return document.querySelector('#agentPage .agmasquee') ? 'masquée' : 'toujours là'; });
    ok(await bal() === 'masquée', nom + ' : balayer une remarque la masque (« Remarque masquée » + Annuler)');
    await p.locator('#agentPage .agmasquee button').click(); await p.waitForTimeout(200);
    ok(await p.locator('#agentPage .agmasquee').count() === 0 && await p.locator('#agentPage .agsortie').count() === 2, nom + ' : « Annuler » la fait revenir');
  }
  /* archiver une restitution (v231, téléphone et ordinateur) : elle quitte la liste, reste dans « Archivés » (repliée), se désarchive ; marqueur synchronisé, rien d'effacé */
  await p.locator('#agentPage .agsortie .agarchbt').first().click(); await p.waitForTimeout(300);
  ok(await p.locator('#agentPage .agsortie:not(.agarch .agsortie)').count() === 1, nom + ' : « Archiver » retire la restitution de la liste (1 reste)');
  ok(await p.locator('#agentPage details.agarch summary').textContent() === 'Archivés (1)' && !(await p.locator('#agentPage details.agarch').evaluate(e => e.open)), nom + ' : elle est dans « Archivés (1) », section repliée');
  const mq = await p.evaluate(() => { const A = window.__equipe.ASSIST, k = Object.keys(A.A).filter(n => n[0] !== '_'); return { n: k.length, a: k.length && A.A[k[0]].a, gardees: (A.d.liste[0].sorties || []).length }; });
  ok(mq.n === 1 && mq.a === 1 && mq.gardees === 2, nom + ' : un marqueur d\'archivage (champ par champ), les 2 restitutions sont toujours dans les données');
  await p.waitForTimeout(900);
  const st = await p.evaluate(() => { try { const c = JSON.parse(localStorage.getItem('carte-de-vie-v1') || '{}')['meta/assist_archives'] || {}, k = Object.keys(c).filter(n => n[0] !== '_'); return { f: !!(c._m && k.length && c._f && c._f[k[0]]), x: (c._x || []).length, k: k.length }; } catch (e) { return { k: -1 }; } });
  ok(st.k === 1 && st.f && st.x === 0, nom + ' : le marqueur est enregistré daté champ par champ (_m, _f) et n\'est pas une suppression (_x vide)');
  await p.locator('#agentPage details.agarch summary').click(); await p.waitForTimeout(150);
  ok(await p.locator('#agentPage details.agarch .agarchbt').textContent() === 'Désarchiver', nom + ' : « Désarchiver » est proposé dans la section');
  await p.locator('#agentPage details.agarch .agarchbt').click(); await p.waitForTimeout(300);
  ok(await p.locator('#agentPage .agsortie').count() === 2 && await p.locator('#agentPage details.agarch').count() === 0, nom + ' : désarchivée, elle revient dans la liste (2) et la section disparaît');
  await p.waitForSelector('#agentPage .agrond.grand.portrait .agimg', { timeout: 3000 }).catch(() => {});
  ok(await p.locator('#agentPage .agrond.grand.portrait .agimg').count() === 1, nom + ' : la fiche montre la carte entière (portrait)');
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
  /* v244 (App téléphone) : les quatre onglets tiennent sans glisser, la zone d'écriture et « Envoyer » sont entiers ; l'app ordinateur garde ses onglets d'origine */
  await p.evaluate(() => { window.__equipe.FUTUR.ong = 'parle'; window.__equipe.FUTUR.ouvre(); }); await p.waitForTimeout(250);
  const g = await p.evaluate(() => { const s = document.querySelector('#futurPage .agseg'), q = document.querySelector('#futurPage .convf'), t = q.querySelector('textarea').getBoundingClientRect(), bt = q.querySelector('.vbtn').getBoundingClientRect(), W = innerWidth;
    return { disp: getComputedStyle(s).display, sw: s.scrollWidth <= s.clientWidth + 1, onglets: [...s.querySelectorAll('button')].every(x => { const r = x.getBoundingClientRect(); return r.left >= 0 && r.right <= W; }),
      ecrit: t.left >= 0 && t.right <= W && bt.left >= 0 && bt.right <= W && bt.bottom <= innerHeight }; });
  if (nom === 'App téléphone') ok(g.sw && g.onglets && g.ecrit, nom + ' : onglets entiers sans glisser, zone d\'écriture et « Envoyer » entiers (' + JSON.stringify(g) + ')');
  else ok(g.disp === 'flex', nom + ' : onglets inchangés (' + g.disp + ')');
  /* v244 : ce qui a été gardé faute de réponse repart seul dès que le système répond ; s'il ne répond pas, rien ne change */
  const rep = await p.evaluate(async () => { const C = window.__equipe.CONV, F = window.__equipe.FUTUR, ancien = C.envoie, k = 'conv:' + F.cle(); let n = 0, recu = null;
    const lire = () => JSON.parse(localStorage.getItem(k) || '[]').map(m => m.de + ':' + m.texte + (m.attente ? '*' : ''));
    localStorage.setItem(k, JSON.stringify([{ de: 'moi', texte: 'Un', attente: true }, { de: 'moi', texte: 'Deux', attente: true }]));
    sessionStorage.clear(); C.envoie = async () => { n++; return { ok: false, bientot: true, msg: 'Bientôt disponible' }; }; F.ouvre(); await new Promise(r => setTimeout(r, 400)); const muet = { n, L: lire() };
    sessionStorage.clear(); n = 0; C.envoie = async c => { n++; recu = c.futur.texte; return { ok: true, j: { ok: true, reponse: 'Reçu.' } }; }; F.ouvre(); await new Promise(r => setTimeout(r, 500)); const branche = { n, recu, L: lire() };
    C.envoie = ancien; localStorage.removeItem(k); return { muet, branche }; });
  ok(rep.muet.n === 1 && rep.muet.L.join('|') === 'moi:Un*|moi:Deux*', nom + ' : système muet, les messages gardés restent gardés, un par un (' + rep.muet.L.join('|') + ')');
  ok(rep.branche.n === 1 && rep.branche.recu === 'Un\nDeux' && rep.branche.L.join('|') === 'moi:Un|moi:Deux|lui:Reçu.', nom + ' : système branché, les messages gardés partent seuls et la réponse arrive (' + rep.branche.L.join('|') + ')');
  /* bouton « précédent » (app téléphone, 18/10) : il ferme seulement l'écran du dessus et revient là où l'on était, pas à la carte */
  if (nom === 'App téléphone') {
    const vis = () => p.evaluate(() => [...document.querySelectorAll('aside.page')].filter(x => !x.hidden).map(x => x.id).join(','));
    await p.goBack(); await p.waitForTimeout(250);
    ok(await vis() === '', nom + ' : précédent depuis Moi dans 5 ans ramène à la carte (' + (await vis() || 'carte') + ')');
    await p.evaluate(() => window.__equipe.ASSIST.ouvre()); await p.locator('#assistPage .agposte').first().click(); await p.waitForTimeout(250);
    await p.goBack(); await p.waitForTimeout(250);
    ok(await vis() === 'assistPage', nom + ' : précédent depuis la fiche d\'un assistant revient à « Mes assistants » (' + await vis() + ')');
    await p.goBack(); await p.waitForTimeout(250);
    ok(await vis() === '', nom + ' : un second précédent revient à la carte (' + (await vis() || 'carte') + ')');
    await p.goBack(); await p.waitForTimeout(250);
    ok(/index\.html/.test(p.url()) && await p.locator('#board').count() === 1, nom + ' : un précédent de plus ne fait pas sortir de l\'app');
  }
  const larg = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1); ok(larg, nom + ' : aucun défilement horizontal');
  ok(!err.length, nom + ' : aucune erreur JavaScript' + (err.length ? ' : ' + err.slice(0, 2).join(' / ') : ''));
  await ctx.close();
}
await b.close();
console.log(ko ? ko + ' échec(s)' : 'Tout est vert'); process.exit(ko ? 1 : 0);
