// Glisser une image sur la fiche d'un assistant (v250), dans le navigateur, en deux parties : App téléphone puis App ordinateur.
// Usage : serveur sur la racine du dépôt (python3 -m http.server 8767), puis
//   PLAYWRIGHT=… CHROMIUM=… URL=http://localhost:8767/index.html OUT=dossier-des-captures node tests/avatar-glisser.mjs
// Faux GitHub : aucun appel réel. Vérifie, sur ordinateur : la fiche s'illumine au survol d'un fichier, le dépôt d'une image envoie un JPEG
// de 400 px au plus vers perso/avatars/<id>.jpg (avec le sha si le fichier existe, sans sinon), met identite.image à jour sans toucher au reste
// (autres assistants et autres champs intacts, _f.liste renouvelé), affiche « Avatar mis à jour » ; un fichier qui n'est pas une image ou une
// synchro non configurée ne fait rien et le disent. Sur téléphone : rien ne change (aucun envoi). Données inventées.
import fs from 'fs';
import path from 'path';
const _pw = await import(process.env.PLAYWRIGHT || 'playwright'), { chromium, devices } = _pw.chromium ? _pw : _pw.default;
const ADR = (process.env.URL || 'http://localhost:8767/index.html') + '?test';
const OUT = process.env.OUT || '';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
let ko = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'KO  ') + m); if (!c) ko++; };
const EQUIPE = { liste: [
  { id: 'veilleur', nom: 'Veilleur', statut: 'actif', role: 'Surveille un sujet de démonstration.', identite: { icone: 'loupe', couleur: '#ff0000', devise: 'Je regarde pour toi.' }, sorties: [] },
  { id: 'scribe', nom: 'Scribe', statut: 'actif', role: 'Écrit des brouillons.', identite: { icone: 'plume', image: 'avatars/ancien.jpg' }, sorties: [] }] };
const PROFILS = [['App téléphone', 'telephone', Object.assign({}, devices['Galaxy S9+'], { viewport: { width: 412, height: 915 } })],
  ['App ordinateur', 'ordinateur', { viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false }]];
for (const [nom, cle, opt] of PROFILS) {
  console.log('\n== ' + nom + ' ==');
  const ctx = await b.newContext(Object.assign({}, opt, { serviceWorkers: 'block', locale: 'fr-FR', timezoneId: 'Europe/Paris', colorScheme: 'light' }));
  const envois = []; let existe = false;
  await ctx.route('https://api.github.com/**', async r => {
    const q = r.request(), u = q.url();
    if (/\/contents\/perso\/avatars\/veilleur\.jpg/.test(u)) {
      if (q.method() === 'PUT') { envois.push(JSON.parse(q.postData())); existe = true; return r.fulfill({ status: 201, contentType: 'application/json', body: '{"content":{"sha":"nouveau"}}' }); }
      return r.fulfill(existe ? { status: 200, contentType: 'application/json', body: '{"sha":"ancien-sha"}' } : { status: 404, contentType: 'application/json', body: '{}' });
    }
    return r.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
  const p = await ctx.newPage(); const erreurs = []; p.on('pageerror', e => erreurs.push(String(e)));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) erreurs.push(m.text()); });
  await p.goto(ADR); await p.waitForFunction(() => window.__equipe && window.__equipe.AVATAR, null, { timeout: 20000 }); await p.waitForTimeout(1200);
  await p.evaluate(() => { const o = document.getElementById('onb'); if (o) o.hidden = true; });
  const ouvre = async () => { await p.evaluate(d => { const { ASSIST } = window.__equipe; ASSIST.charge(d); ASSIST.fiche('veilleur'); }, EQUIPE); await p.waitForSelector('#agentPage .agtete', { state: 'visible' }); };
  /* un doc de test local : la carte est le stockage local de l'app, la mise à jour passe par db.doc().update comme le reste de l'app */
  await p.evaluate(d => window.__equipe.db.doc('meta/assistants').set(d), EQUIPE);
  await ouvre();
  const image = (type, nomf, w, h) => p.evaluateHandle(([t, n, w, h]) => new Promise(ok => { const k = document.createElement('canvas'); k.width = w; k.height = h; const g = k.getContext('2d'); g.fillStyle = '#002fa7'; g.fillRect(0, 0, w, h); k.toBlob(bl => ok(new File([bl], n, { type: t })), 'image/png'); }), [type, nomf, w, h]);
  const evt = (type, f) => p.evaluate(([t, f]) => { const dt = new DataTransfer(); if (f) dt.items.add(f); const e = new DragEvent(t, { bubbles: true, cancelable: true, dataTransfer: dt }); (document.querySelector('#agentPage .agrond') || document.getElementById('agentPage')).dispatchEvent(e); return e.defaultPrevented; }, [type, f]);
  const aide = await p.evaluate(() => { const e = document.querySelector('#agentPage .avaide'); return !!e && getComputedStyle(e).display !== 'none'; });
  ok(aide === (cle === 'ordinateur'), nom + ' : la consigne « glisse une image » ' + (cle === 'ordinateur' ? 'est visible' : 'reste cachée'));
  const f1 = await image('image/png', 'portrait.png', 800, 600);
  if (cle === 'telephone') {
    await evt('dragover', f1); await evt('drop', f1); await p.waitForTimeout(500);
    ok(envois.length === 0 && await p.locator('.avmsg').count() === 0, nom + ' : le glisser-déposer ne fait rien sur le téléphone (aucun envoi, aucun message)');
    ok(erreurs.length === 0, nom + ' : aucune erreur dans la console (' + erreurs.join(' | ') + ')');
    await ctx.close(); continue;
  }
  const avant = await p.evaluate(() => JSON.parse(JSON.stringify(window.__equipe.ASSIST.d)));
  await p.evaluate(() => localStorage.setItem('carte-de-vie-sync', JSON.stringify({ repo: 'compte/depot-demo', token: 'jeton-de-demo' })));
  /* survol : la fiche s'illumine, puis s'éteint si on s'en va */
  ok(await evt('dragover', f1), nom + ' : survol d\'un fichier accepté (dépôt autorisé)');
  ok(await p.evaluate(() => document.getElementById('agentPage').classList.contains('avdepose')), nom + ' : la fiche est en surbrillance au survol');
  if (OUT) await p.screenshot({ path: path.join(OUT, cle + '-avatar-survol.png') });
  await p.evaluate(() => document.dispatchEvent(Object.assign(new Event('dragleave', { bubbles: true }), { relatedTarget: null })));
  ok(await p.evaluate(() => !document.getElementById('agentPage').classList.contains('avdepose')), nom + ' : la surbrillance s\'éteint quand le fichier s\'en va');
  /* dépôt d'une image : premier envoi, le fichier n'existe pas encore */
  await evt('dragover', f1); await evt('drop', f1);
  await p.waitForSelector('.avmsg', { timeout: 8000 }); await p.waitForTimeout(300);
  ok(/Avatar mis à jour/.test(await p.textContent('.avmsg')), nom + ' : message « Avatar mis à jour »');
  ok(envois.length === 1 && !('sha' in envois[0]), nom + ' : un seul envoi, sans sha (le fichier n\'existait pas)');
  const dim = await p.evaluate(c => new Promise(ok => { const i = new Image; i.onload = () => ok([i.naturalWidth, i.naturalHeight]); i.onerror = () => ok(null); i.src = 'data:image/jpeg;base64,' + c; }), envois[0].content);
  ok(dim && Math.max(dim[0], dim[1]) === 400 && dim[0] / dim[1] > 1.3, nom + ' : JPEG réduit à 400 px, proportions gardées (' + JSON.stringify(dim) + ')');
  const apres = await p.evaluate(() => ({ d: JSON.parse(JSON.stringify(window.__equipe.ASSIST.d)), doc: JSON.parse(JSON.stringify(window.__equipe.db.dump ? JSON.parse(window.__equipe.db.dump())['meta/assistants'] : null)) }));
  ok(apres.d.liste[0].identite.image === 'avatars/veilleur.jpg', nom + ' : identite.image = avatars/veilleur.jpg');
  const sansH = o => JSON.stringify(o, (k, v) => k === '_h' ? undefined : v);
  ok(sansH(apres.d.liste[1]) === sansH(avant.liste[1]) && apres.d.liste[0].identite.devise === 'Je regarde pour toi.' && apres.d.liste[0].identite.couleur === '#ff0000' && apres.d.liste[0].role === avant.liste[0].role,
    nom + ' : rien d\'autre n\'a changé (autre assistant, devise, couleur, rôle ; le marquage interne _h de la carte mis à part)');
  ok(apres.doc && apres.doc._f && apres.doc._f.liste >= Date.now() - 20000 && apres.doc._m >= Date.now() - 20000, nom + ' : _m et _f.liste remis à maintenant');
  ok(await p.locator('#agentPage .agimg, #agentPage .agphoto img').count() >= 1, nom + ' : la fiche affiche déjà la nouvelle image');
  if (OUT) await p.screenshot({ path: path.join(OUT, cle + '-avatar-mis-a-jour.png') });
  /* deuxième dépôt : le fichier existe, le sha est repris */
  await p.waitForTimeout(5200); const f2 = await image('image/png', 'autre.png', 300, 300);
  await evt('dragover', f2); await evt('drop', f2); await p.waitForSelector('.avmsg', { timeout: 8000 }); await p.waitForTimeout(300);
  ok(envois.length === 2 && envois[1].sha === 'ancien-sha', nom + ' : second dépôt, le sha du fichier existant est envoyé');
  /* un fichier qui n'est pas une image */
  await p.waitForTimeout(5200);
  const txt = await p.evaluateHandle(() => new File(['bonjour'], 'note.txt', { type: 'text/plain' }));
  await evt('dragover', txt); await evt('drop', txt); await p.waitForSelector('.avmsg'); 
  ok(/pas une image/.test(await p.textContent('.avmsg')) && envois.length === 2, nom + ' : un fichier texte est refusé, rien n\'est envoyé');
  /* synchro non configurée */
  await p.waitForTimeout(5200);
  await p.evaluate(() => localStorage.removeItem('carte-de-vie-sync'));
  await evt('dragover', f1); await evt('drop', f1); await p.waitForSelector('.avmsg');
  ok(/pas configurée/.test(await p.textContent('.avmsg')) && envois.length === 2, nom + ' : sans synchro, message clair et rien d\'enregistré');
  ok(erreurs.length === 0, nom + ' : aucune erreur dans la console (' + erreurs.join(' | ') + ')');
  await ctx.close();
}
await b.close();
console.log(ko ? `\n${ko} échec(s)` : '\nTout est vert');
process.exit(ko ? 1 : 0);
