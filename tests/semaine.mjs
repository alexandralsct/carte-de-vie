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
  verif(!err.length, nom + ' : aucune erreur JavaScript', err);
  await c.close();
}
await b.close(); console.log(ko ? '\n' + ko + ' ÉCHEC(S)' : '\nTout est bon.'); process.exit(ko ? 1 : 0);
