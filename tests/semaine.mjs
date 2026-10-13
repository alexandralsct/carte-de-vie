// « Ma semaine » : le tableau horaire est dans la page « Ma semaine » (plus dans la carte des habitudes) ; semaine encore
// vide : l'encart de la passerelle s'affiche et la première lecture du tableau a lieu tout de suite (passerelle simulée).
// App téléphone puis app ordinateur, séparément.
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
const URL = process.env.URL || 'http://localhost:8767/index.html';
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const SEM = { feuille: 'S1', categories: [{ nom: 'A', hex: '#7fc97f' }, { nom: 'B', hex: '#386cb0' }],
  jours: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'].map((n, k) => ({ nom: n, date: '2026-01-0' + (5 + k), creneaux: k < 3 ? [['09:00', 'Un', 1], ['09:30', 'Un', 1], ['18:00', 'Deux', 0]] : [] })) };
let ko = 0; const verif = (ok, m, x) => { console.log((ok ? 'OK  ' : 'KO  ') + m + (ok || x === undefined ? '' : ' ' + JSON.stringify(x))); if (!ok) ko++; };
for (const [nom, ctx] of [['App téléphone', { viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true }], ['App ordinateur', { viewport: { width: 1280, height: 800 } }]]) {
  console.log('== ' + nom);
  const c = await b.newContext(ctx), p = await c.newPage(), err = []; p.on('pageerror', e => err.push(e.message));
  await c.addInitScript(() => { ['hRap', 'compagnon', 'mouvements'].forEach(k => localStorage.setItem(k, '0')); localStorage.setItem('carte-de-vie-vu', '1');
    localStorage.setItem('carte-de-vie-passerelle', JSON.stringify({ url: 'https://script.google.com/macros/s/essai/exec', cle: 'k', t: Date.now() })); });
  let lectures = 0;
  await c.route('https://script.google.com/**', r => { const ecrit = /saisies/.test(r.request().postData() || ''); if (!ecrit) lectures++;
    r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(ecrit ? { res: [] } : SEM) }); });
  await p.goto(URL + '?demo'); await p.waitForTimeout(2000);
  verif(!(await p.locator('.hsemaine').count()), nom + ' : le tableau horaire n\'est plus dans la carte des habitudes');
  await p.locator("button:has-text('Ma semaine')").first().click(); await p.waitForTimeout(2500);
  const r = await p.evaluate(() => { const h = document.querySelector('#trajIn .hsemaine'); return { ici: !!h, encart: !!(h && h.querySelector('.sempass')), blocs: h ? h.querySelectorAll('.semb').length : 0, deborde: document.documentElement.scrollWidth > document.documentElement.clientWidth }; });
  verif(r.ici, nom + ' : le tableau horaire est dans la page « Ma semaine »', r);
  verif(lectures >= 1, nom + ' : semaine vide → le tableau est relu tout de suite, même lu il y a moins de 10 min', { lectures });
  verif(r.blocs === 6 && r.encart, nom + ' : la semaine lue s\'affiche (6 moments) avec l\'encart de la passerelle', r);
  verif(!r.deborde, nom + ' : rien ne dépasse en largeur');
  const tri = await p.evaluate(() => [...document.querySelectorAll('#trajIn .card h3')].map(h => h.textContent));
  verif(!tri.some(t => /grands sujets|horizons|décisions/i.test(t)), nom + ' : onglet « Ma semaine » : seulement les priorités et le tableau', tri);
  const lu0 = lectures; await p.locator("#trajIn .semnav button[data-n=av]").first().click(); await p.waitForTimeout(800);
  const av = await p.evaluate(() => ({ lab: (document.querySelector('#trajIn .semnavl') || {}).textContent, blocs: document.querySelectorAll('#trajIn .semb').length, ajout: !!document.querySelector('#trajIn .hsemaine h4'), apres: !(document.querySelector('#trajIn .semnav [data-n=ap]') || {}).disabled }));
  verif(lectures > lu0 && av.lab === 'La semaine dernière' && av.blocs === 6 && !av.ajout && av.apres, nom + ' : « Semaine d\'avant » lit la semaine dernière dans le tableau (consultation seule)', av);
  await p.locator("#trajIn .semnav button:has-text('Revenir')").click(); await p.waitForTimeout(300);
  verif(await p.evaluate(() => document.querySelector('#trajIn .semnavl').textContent === 'Cette semaine' && !!document.querySelector('#trajIn .hsemaine h4')), nom + ' : « Revenir à cette semaine »');
  await p.locator("#trajIn .seg button:has-text('Mes sujets')").click(); await p.waitForTimeout(500);
  const su = await p.evaluate(() => ({ h3: [...document.querySelectorAll('#trajIn .card h3')].map(h => h.textContent), tableau: !!document.querySelector('#trajIn .hsemaine'), actif: (document.querySelector('#trajIn .seg [aria-selected=true]') || {}).textContent }));
  verif(su.actif === 'Mes sujets' && !su.tableau && su.h3.some(t => /grands sujets/i.test(t)) && su.h3.some(t => /horizons/i.test(t)) && su.h3.some(t => /décisions/i.test(t)), nom + ' : onglet « Mes sujets » : grands sujets, horizons, décisions, sans le tableau', su);
  await p.locator("#trajIn .seg button:has-text('Ma semaine')").click(); await p.waitForTimeout(500);
  verif(await p.evaluate(() => !!document.querySelector('#trajIn .hsemaine') && (document.querySelector('#trajIn .seg [aria-selected=true]') || {}).textContent === 'Ma semaine'), nom + ' : retour à l\'onglet « Ma semaine »');
  verif(!err.length, nom + ' : aucune erreur JavaScript', err);
  await c.close();
}
await b.close(); console.log(ko ? '\n' + ko + ' ÉCHEC(S)' : '\nTout est bon.'); process.exit(ko ? 1 : 0);
