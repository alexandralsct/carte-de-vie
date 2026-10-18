/* Tests du Lot C (V.222) sur des données de démonstration neutres : cercle « Moi » borné sur téléphone, pages retirables (même la première),
   liens mis en avant, frise de la famille depuis l'arbre, QR de synchro chiffré par un code (jamais de clé en clair), lisibilité du thème sombre,
   messages déjà présents dans LIFE écartés, Atelier sans clé.
   Usage : python3 -m http.server 8767 (racine du dépôt), puis node tests/lotc.mjs.
   Deux parties : « App téléphone » (412 px, tactile) puis « App ordinateur » (1280 px, souris). */
const { chromium, devices } = await import(process.env.PLAYWRIGHT || 'playwright');
const URL = (process.env.URL || 'http://localhost:8767/index.html') + '?test';
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
let ko = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'KO  ') + m); if (!c) ko++; };
const it = (t, done = false) => ({ id: Math.random().toString(36).slice(2, 13), text: t, done });
const esp = (name, x, y, rub, extra = {}) => Object.assign({ name, groupe: 'Vie perso', color: '#3E95C9', prio: 2, x, y, rub, tasks: [it('Une tâche')], ideas: [it('Une idée')], dates: [], links: [], log: [], _m: Date.now() }, extra);
const DEMO = {
  'espaces/studio': esp('Studio de démo', 30, 30, [
    { id: 'a1', name: 'Un', items: [it('a')] }, { id: 'a2', name: 'Deux', items: [it('b')] }, { id: 'a3', name: 'Trois', items: [it('c')] }, { id: 'a4', name: 'Quatre', items: [it('d')] }],
    { links: [{ id: 'l1', url: 'https://exemple.org/outil', title: 'Un outil visible', page: 'Outils' }, { id: 'l2', url: 'https://exemple.org/autre', title: 'Un lien rangé' }],
      disp: { page: { a4: 'Outils', a3: 'Outils' }, cachees: ['À faire'] } }),
  'espaces/jardin': esp('Jardin', 65, 25, [{ id: 'j1', name: 'À planter', items: [it('Tomates')] }]),
  'meta/layout': { mx: 50, my: 50, sx: -1.5, sy: -900, _m: Date.now() },
};
const TEL = Object.assign({}, devices['Galaxy S9+'], { viewport: { width: 412, height: 915 } }), ORDI = { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false };
const GED = [{ id: 'r', n: 'Racine Dupont', nb: '1990', lb: 'Ville A', nd: '', ld: '', p: 'p', mo: 'm' }, { id: 'p', n: 'Père Dupont', nb: '1 APR 1960', lb: 'Ville B', nd: '2020', ld: 'Ville C', m: 'Menuisier', p: 'gp' },
  { id: 'm', n: 'Mère Durand', nb: '1962', lb: 'Ville D', nd: '', ld: '' }, { id: 'gp', n: 'Aïeul Dupont', nb: '1930', lb: '', nd: 'BEF 26 OCT 1990', ld: 'Ville E' }, { id: 'x', n: 'Cousin Éloigné', nb: '1970', lb: '', nd: '', ld: '' }];
for (const [nom, profil] of [['App téléphone', TEL], ['App ordinateur', ORDI]]) {
  console.log('— ' + nom);
  const tel = profil === TEL;
  const ctx = await b.newContext(Object.assign({}, profil, { serviceWorkers: 'block', locale: 'fr-FR', timezoneId: 'Europe/Paris' }));
  await ctx.addInitScript(([carte]) => { if (!sessionStorage.getItem('init')) { sessionStorage.setItem('init', '1'); localStorage.clear(); localStorage.setItem('test:carte-de-vie-v1', carte);
    ['hRap', 'compagnon', 'mouvements'].forEach(k => localStorage.setItem('test:' + k, '0')); ['compagnonChoisi', 'carte-de-vie-vu'].forEach(k => localStorage.setItem('test:' + k, '1'));
    localStorage.setItem('test:theme', 'sombre'); localStorage.setItem('test:carte-de-vie-sync', JSON.stringify({ repo: 'compte-demo/depot-demo', token: '' + ['github', 'pat', 'JETON0123456789abcdefghijklmnopqrstuvwxyz'].join('_') + '' })); } }, [JSON.stringify(DEMO)]);
  await ctx.route('https://api.github.com/**', r => r.abort());
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.goto(URL); await p.waitForTimeout(1800);
  /* 1. le cercle « Moi » reste dans la planche, sous les boutons du haut (décalage enregistré trop haut) */
  if (tel) {
    const g = await p.evaluate(() => { const r = e => e.getBoundingClientRect(), B = r(document.getElementById('board')), M = r(document.querySelector('.moi')); let hb = 0; B && document.querySelectorAll('#board .v3add,#board .rgBtn').forEach(e => { if (e.offsetParent) hb = Math.max(hb, r(e).bottom); }); return { top: M.top - B.top, bas: B.bottom - M.bottom, sousBoutons: M.top >= hb - 1 }; });
    ok(g.top >= 0 && g.bas >= 0 && g.sousBoutons, nom + ' : le cercle « Moi » reste dans la planche et sous « + Espace » / « Réorganiser » (' + Math.round(g.top) + ' px du haut)');
  } else ok(true, nom + " : le décalage du cercle « Moi » ne concerne que l'app téléphone (aucun changement ici)");
  /* 2. page retirée (même « L'essentiel »), liens mis en avant, page rangée par la propriétaire */
  await p.evaluate(() => { const e = [...document.querySelectorAll('#board .node')].find(n => /^Studio/.test(n.textContent.trim())); if (e) { e.scrollIntoView(); e.click(); } });
  await p.waitForTimeout(900);
  const onglets = await p.evaluate(() => [...document.querySelectorAll('#pane .rpnav .rpt')].map(x => x.textContent.trim()));
  ok(onglets.length >= 2 && !onglets.includes('À faire'), nom + ' : la première page retirée (« À faire ») n\'apparaît plus, les autres restent (' + onglets.join(' | ') + ')');
  const iO = onglets.indexOf('Outils'); ok(iO >= 0, nom + " : la page « Outils » rangée par la propriétaire existe");
  if (iO >= 0) { await p.evaluate(i => document.querySelectorAll('#pane .rpnav .rpt')[i].click(), iO); await p.waitForTimeout(500);
    const l = await p.evaluate(() => [...document.querySelectorAll('#pane a.lvl')].map(a => a.textContent + '|' + a.getAttribute('href')));
    ok(l.length === 1 && /Un outil visible/.test(l[0]) && /exemple\.org\/outil$/.test(l[0]), nom + ' : le lien mis en avant est un bouton visible sur sa page (le lien rangé reste à sa place)'); }
  /* 3. frise de la famille depuis l'arbre : seulement la lignée directe */
  const fr = await p.evaluate(g => window.friseArbre({ jeu: { ged: g, gedRacine: 'r' } }), GED);
  ok(fr.length === 6 && !fr.some(e => /Cousin/.test(e.t)) && fr.every(e => e.auto), nom + " : la frise lit les naissances et décès de la lignée directe, pas des cousins (" + fr.length + ' événements)');
  ok(fr.some(e => /Père Dupont meurt · Menuisier/.test(e.t) && e.a === '2020') && fr.some(e => e.a === '1990' && /Aïeul Dupont meurt/.test(e.t)), nom + ' : années et métiers repris tels quels (« BEF 26 OCT 1990 » → 1990)');
  /* 4. QR de synchro : chiffré, jamais de clé en clair ; mauvais code refusé ; vecteur de référence du QR */
  const q = await p.evaluate(async () => { const { APPAIR, QRG } = window.__lotc, code = APPAIR.code(), t = await APPAIR.chiffre({ r: 'compte-demo/depot-demo', t: '' + ['github', 'pat', 'JETON0123456789'].join('_') + '', e: Date.now() + 120000 }, code), lien = APPAIR.lien(t);
    const o = await APPAIR.recoit(lien, code.slice(0, 4) + ' ' + code.slice(4).toLowerCase()); let mauvais = 'accepté'; try { await APPAIR.recoit(lien, 'AAAAAAAA'); } catch (e) { mauvais = 'refusé'; }
    let perime = 'accepté'; try { await APPAIR.recoit(await APPAIR.chiffre({ r: 'a/b', t: 'x', e: Date.now() - 60000 }, code), code); } catch (e) { perime = 'refusé'; }
    const svg = QRG.svg(lien, 248), M = QRG.encode('lotc-test-vecteur-1234567890abcdef', 'M'), bits = M.map(l => l.map(b => b ? 1 : 0).join('')).join('');
    let h = 0; for (let i = 0; i < bits.length; i++) h = (h * 31 + (bits.charCodeAt(i) - 48 + 1)) >>> 0;
    return { code, ok: o.r === 'compte-demo/depot-demo' && o.t === '' + ['github', 'pat', 'JETON0123456789'].join('_') + '', mauvais, perime, enClair: lien.includes('JETON0123') || svg.includes('JETON0123'), svg: /^<svg/.test(svg), n: M.length, h }; });
  ok(/^[A-Z0-9]{8}$/.test(q.code) && q.ok, nom + ' : le code à 8 caractères déchiffre le dépôt et la clé (écrits en minuscules avec une espace : acceptés)');
  ok(q.mauvais === 'refusé' && q.perime === 'refusé', nom + ' : un mauvais code et un QR périmé sont refusés');
  ok(!q.enClair && q.svg, nom + ' : ni le lien ni le QR ne contiennent la clé en clair');
  ok(q.n === 29 && q.h === 303251190, nom + ' : le QR de référence est inchangé (taille ' + q.n + ', empreinte ' + q.h + ')');
  /* 5. lisibilité : du bleu Klein sur une surface sombre est corrigé */
  const lis = await p.evaluate(async () => { const d = document.createElement('div'); d.style.cssText = 'background:#172a52;padding:8px'; const s = document.createElement('span'); s.textContent = 'Texte de démonstration'; s.style.color = '#002FA7'; d.appendChild(s); document.body.appendChild(d);
    await new Promise(r => setTimeout(r, 600)); const { LISI } = window.__lotc, f = LISI.rgb(getComputedStyle(d).backgroundColor), c = LISI.rgb(getComputedStyle(s).color); const r = LISI.rapport(c, f); d.remove(); return r; });
  ok(lis >= 3, nom + ' : un texte bleu Klein sur surface sombre est rendu lisible (contraste ' + lis.toFixed(1) + ')');
  /* 6. assistants : les messages déjà dans LIFE ne sont plus répétés */
  const as = await p.evaluate(() => { const A = window.__equipe.ASSIST, S = [{ id: 's', date: '2026-10-17', titre: 'x', trouve: 'y' }]; return [A.sorties({ id: 'life', sorties: S }).length, A.sorties({ id: 'autre', sorties: S }).length]; });
  ok(as[0] === 0 && as[1] === 1, nom + ' : les messages de l\'assistant déjà présents dans LIFE sont écartés, ceux des autres restent');
  await p.goto(URL); await p.waitForTimeout(1500);
  /* 7. Atelier sans clé Gemini : « Créer l'image » renvoie vers la clé au lieu de se taire */
  await p.evaluate(() => { const e = [...document.querySelectorAll('button')].find(e => /^ATELIER/i.test(e.textContent.trim()) && e.offsetParent); if (e) { e.scrollIntoView(); e.click(); } }); await p.waitForTimeout(600);
  await p.fill('#atelierIn textarea', 'Une image de démonstration'); await p.evaluate(() => [...document.querySelectorAll('#atelierIn button')].find(b => /Créer l'image/.test(b.textContent)).click()); await p.waitForTimeout(500);
  const at = await p.evaluate(() => ({ msg: (document.querySelector('#atelierIn .atmsg') || {}).textContent, cle: !!document.querySelector('#atelierIn .atgemhaut input') }));
  ok(/clé Gemini/.test(at.msg || '') && at.cle, nom + " : sans clé Gemini, l'Atelier le dit et montre où la coller (en haut de l'onglet Image)");
  ok(err.length === 0, nom + ' : aucune erreur JavaScript' + (err.length ? ' — ' + err[0] : ''));
  await ctx.close();
}
await b.close();
console.log(ko ? ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
