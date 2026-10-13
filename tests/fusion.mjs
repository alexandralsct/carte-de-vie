/* Tests de la fusion des versions de la carte (synchro entre appareils, le système et les routines).
   Usage : node tests/fusion.mjs                       (vérifie le bloc de fusion de index.html)
           HTML=/chemin/autre/index.html node tests/fusion.mjs   (une autre version, par exemple l'ancienne)
           CARTES="a.json b.json …" node tests/fusion.mjs        (en plus : fusion de vraies sauvegardes locales, deux à deux ;
                                                                   seuls des nombres sont affichés, jamais de contenu)
   Les fonctions testées sont extraites telles quelles de index.html (bloc FUSION:debut … FUSION:fin), sans réécriture.
   Pour une ancienne version (sans ce bloc), le test reprend l'ancien code de fusion (de « const META= » à « const fieldsNow= »).
   Toutes les données de ce fichier sont fictives. */
import fs from 'fs';
import path from 'path';
const ICI = path.dirname(new URL(import.meta.url).pathname);
const HTML = fs.readFileSync(process.env.HTML || path.join(ICI, '..', 'index.html'), 'utf8');
let A;
{ const i = HTML.indexOf('/* FUSION:debut'), j = HTML.indexOf('/* FUSION:fin */');
  if (i >= 0 && j > i) {
    const f = new Function(HTML.slice(i, j) + '\nreturn {mergeDoc,estampille,restampe,creeHorloge,vuDoc};')();
    A = { nom: 'fusion par élément', fusion: f.mergeDoc, ecrire: f.estampille, importer: f.restampe, horloge: f.creeHorloge, vu: f.vuDoc };
  } else {
    const a = HTML.indexOf('const META=k=>'), b0 = HTML.indexOf('const fieldsNow=', a), b = HTML.indexOf('\n', b0);
    if (a < 0 || b0 < 0) throw new Error('code de fusion introuvable');
    const f = new Function(HTML.slice(a, b) + '\nreturn {mergeDoc,tombes,fieldsNow,META};')();
    A = { nom: 'ancienne fusion (par champ)', fusion: f.mergeDoc,
      /* comme update() de l'ancienne version, avec seulement les champs changés (le cas le plus favorable) */
      ecrire: (v, n, now) => { const d = {}; Object.keys(n).forEach(k => { if (!f.META(k) && (!v || JSON.stringify(v[k]) !== JSON.stringify(n[k]))) d[k] = n[k]; });
        return Object.assign({}, v || {}, JSON.parse(JSON.stringify(d)), { _m: now, _f: f.fieldsNow(d, v, now), _x: f.tombes(v, Object.assign({}, v || {}, d)) }); },
      importer: (d, now) => Object.assign({}, d, { _m: now }), horloge: base => ({ now: () => base(), vu() {} }), vu() {} };
  } }
console.log('Fusion testée : ' + A.nom);
let ko = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'KO  ') + m); if (!c) ko++; };
const clone = o => o === undefined ? undefined : JSON.parse(JSON.stringify(o));
const sansMeta = d => { const o = {}; Object.keys(d || {}).forEach(k => { if (!/^_(m|f|x|xt)$/.test(k)) o[k] = d[k]; }); return clone(o); };
const canon = v => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, k === '_x' && Array.isArray(v[k]) ? [...v[k]].map(String).sort() : canon(v[k])])) : v;
const meme = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
/* tous les éléments à id d'un document : Map id → liste des {chemin, élément} */
const ids = d => { const M = new Map(); const w = (v, ch) => { if (Array.isArray(v)) v.forEach(x => { if (x && typeof x === 'object' && !Array.isArray(x) && x.id != null) { const k = String(x.id); if (!M.has(k)) M.set(k, []); M.get(k).push({ ch, x }); Object.keys(x).forEach(c => w(x[c], ch + '/' + k + '/' + c)); } else w(x, ch); });
  else if (v && typeof v === 'object') Object.keys(v).forEach(c => { if (!/^_/.test(c)) w(v[c], ch ? ch + '/' + c : c); }); }; w(d, ''); return M; };
const trouve = (d, id) => (ids(d).get(id) || []).map(o => o.x);
/* horloge simulée : chaque appareil a son décalage */
let T = 1.8e12; const avance = ms => { T += ms; };
class Appareil {
  constructor(decalage = 0) { this.dec = decalage; this.H = A.horloge(() => T + this.dec); this.doc = null; }
  ecrit(f) { const n = f(sansMeta(this.doc)); this.doc = A.ecrire(clone(this.doc), n, this.H.now()); return this; }
  recoit(d) { d = clone(d); A.vu(this.H, d); this.doc = A.fusion(d, this.doc); return this; }
}
const BASE = () => ({ name: 'Jardin', notes: '', tasks: [{ id: 't1', text: 'Tailler la haie', done: false }],
  rub: [{ id: 'r1', name: 'À planter', items: [{ id: 'i1', text: 'Tomates', done: false }, { id: 'i2', text: 'Radis', done: false }] },
    { id: 'r2', name: 'Courses', items: [{ id: 'i3', text: 'Terreau', done: false }] },
    { id: 'r3', name: 'Hauteur', type: 'mesures', releves: [{ id: 'a', d: '2026-01-01', v: 1 }], gestes: [{ id: 'g1', nom: 'Arroser', days: [] }] }],
  log: [] });
/* deux appareils partent de la même version */
const deux = (decB = 0) => { const X = new Appareil(); X.ecrit(() => BASE()); const a = new Appareil(), b = new Appareil(decB); a.recoit(X.doc); b.recoit(X.doc); avance(1000); return [a, b]; };
const lesDeux = (a, b) => [A.fusion(clone(a.doc), clone(b.doc)), A.fusion(clone(b.doc), clone(a.doc))];
const rub = (d, id) => d.rub.find(r => r.id === id);

console.log('\n-- Les 6 scénarios de perte de l\'audit du 13/10 --');
{ const [a, b] = deux(); a.ecrit(d => { rub(d, 'r1').items[0].done = true; return d; }); avance(10e3);
  b.ecrit(d => { rub(d, 'r2').items.push({ id: 'i4', text: 'Graines', done: false }); return d; });
  for (const m of lesDeux(a, b)) ok(trouve(m, 'i1')[0]?.done === true && trouve(m, 'i4').length === 1, '1. A coche un élément, B ajoute ailleurs plus tard : la coche et l\'ajout sont gardés'); }
{ const [a, b] = deux(); a.ecrit(d => { const t = d.tasks.shift(); rub(d, 'r1').items.push(t); return d; }); avance(10e3);
  b.ecrit(d => { rub(d, 'r2').name = 'Achats'; return d; });
  for (const m of lesDeux(a, b)) ok(trouve(m, 't1').length === 1 && rub(m, 'r1').items.some(x => x.id === 't1') && rub(m, 'r2').name === 'Achats', '2. A déplace une tâche dans une rubrique, B renomme une autre rubrique : la tâche est à sa nouvelle place, une seule fois'); }
{ const [a, b] = deux(3600e3); b.ecrit(d => { d.name = 'Nom de B'; return d; }); avance(5e3); a.recoit(b.doc); avance(55e3);
  a.ecrit(d => { d.name = 'Nom de A'; return d; });
  for (const m of lesDeux(a, b)) ok(m.name === 'Nom de A', '3. B a une horloge en avance d\'une heure ; A modifie après avoir reçu la version de B : la modification de A l\'emporte (' + m.name + ')'); }
{ const [a, b] = deux(); a.ecrit(d => { rub(d, 'r3').releves.push({ id: 'b', d: '2026-01-02', v: 2 }); return d; }); avance(3e3);
  b.ecrit(d => { rub(d, 'r3').releves.push({ id: 'c', d: '2026-01-03', v: 3 }); return d; });
  for (const m of lesDeux(a, b)) { const r = rub(m, 'r3').releves.map(x => x.id).sort().join(','); ok(r === 'a,b,c', '4. A et B ajoutent chacun un relevé à la même rubrique de mesures : ' + r); } }
{ const X = new Appareil(); X.ecrit(() => BASE()); const sauvegarde = clone(X.doc); avance(1000);
  const enLigne = new Appareil(); enLigne.recoit(X.doc); avance(10e3);
  enLigne.ecrit(d => { d.name = 'Modifié en ligne'; rub(d, 'r1').items[1].text = 'Radis modifié en ligne'; rub(d, 'r2').items.push({ id: 'i5', text: 'Ajouté en ligne', done: false }); return d; }); avance(10e3);
  const imp = A.importer(clone(sauvegarde), T);
  for (const m of [A.fusion(clone(enLigne.doc), clone(imp)), A.fusion(clone(imp), clone(enLigne.doc))])
    ok(m.name === 'Jardin' && trouve(m, 'i2')[0]?.text === 'Radis' && trouve(m, 'i5').length === 1, '5. import d\'une sauvegarde après des changements en ligne : la sauvegarde l\'emporte (' + m.name + ', ' + trouve(m, 'i2')[0]?.text + '), l\'élément ajouté en ligne est gardé'); }
{ const X = new Appareil(); X.ecrit(() => Object.assign(BASE(), { ideas: Array.from({ length: 1600 }, (_, i) => ({ id: 'x' + i, text: 'Idée ' + i })) }));
  const a = new Appareil(), b = new Appareil(); a.recoit(X.doc); b.recoit(X.doc); avance(1000);
  a.ecrit(d => { d.ideas = []; return d; }); avance(5e3); b.ecrit(d => { d.notes = 'Une note'; return d; });
  for (const m of lesDeux(a, b)) ok(m.ideas.length === 0 && m.notes === 'Une note', '6. 1 600 suppressions dans un document : aucune ne revient (' + m.ideas.length + ' revenues)'); }

console.log('\n-- Autres cas --');
{ const [a, b] = deux(); a.ecrit(d => { rub(d, 'r1').items.splice(1, 1); return d; }); avance(10e3); b.ecrit(d => { rub(d, 'r1').items[0].done = true; return d; });
  for (const m of lesDeux(a, b)) ok(!trouve(m, 'i2').length && trouve(m, 'i1')[0]?.done === true, 'A supprime un élément, B coche son voisin plus tard : l\'élément ne revient pas, la coche est gardée'); }
{ const [a, b] = deux(); a.ecrit(d => { const it = rub(d, 'r1').items.shift(); rub(d, 'r2').items.push(it); return d; }); avance(10e3);
  b.ecrit(d => { rub(d, 'r1').items[0].text = 'Tomates cerises'; return d; });
  for (const m of lesDeux(a, b)) { const c = trouve(m, 'i1'); ok(c.length >= 1 && c.some(x => x.text === 'Tomates cerises'), 'déplacement par A et modification du même élément par B en même temps : rien n\'est perdu (' + c.length + ' exemplaire(s))'); } }
{ const [a, b] = deux(); a.ecrit(d => { d.tasks.push({ id: 't2', text: 'Nouvelle', done: false }); return d; }); avance(1000); b.ecrit(d => { d.tasks.unshift({ id: 't3', text: 'En tête', done: false }); return d; });
  for (const m of lesDeux(a, b)) ok(m.tasks.map(x => x.id).join(',') === 't3,t1,t2', 'ajouts des deux côtés : chacun reste à sa place (' + m.tasks.map(x => x.id).join(',') + ')'); }
/* écrivain externe (routine, système) : relit le fichier, ajoute sans _h, met _m et _f à jour comme le demande le README */
{ const [a, b] = deux(); a.ecrit(d => { rub(d, 'r1').items[0].done = true; return d; }); avance(10e3);
  const ext = clone(b.doc); rub(ext, 'r2').items.push({ id: 'e1', text: 'Ajouté par un écrivain externe', done: false }); ext._m = T; ext._f = Object.assign({}, ext._f, { rub: T });
  for (const m of [A.fusion(clone(ext), clone(a.doc)), A.fusion(clone(a.doc), clone(ext))]) ok(trouve(m, 'e1').length === 1 && trouve(m, 'i1')[0]?.done === true, 'écrivain externe qui ajoute (sans _h) pendant qu\'un appareil coche : les deux sont gardés'); }
{ const [a, b] = deux(); avance(10e3);
  const ext = clone(b.doc); rub(ext, 'r2').items = []; ext._x = [...(ext._x || []), 'i3']; ext._m = T; ext._f = Object.assign({}, ext._f, { rub: T });
  for (const m of [A.fusion(clone(ext), clone(a.doc)), A.fusion(clone(a.doc), clone(ext))]) ok(!trouve(m, 'i3').length, 'écrivain externe qui retire un élément en l\'ajoutant à _x : il ne revient pas'); }
{ const [a] = deux(); avance(10e3);
  const ext = sansMeta(a.doc); ext.tasks.push({ id: 'e2', text: 'Écrit sans _f', done: false }); ext._m = T;
  let m = null, err = null; try { m = A.fusion(clone(ext), clone(a.doc)); } catch (e) { err = e; }
  ok(!err && trouve(m, 'e2').length === 1 && trouve(m, 'i1').length === 1, 'document écrit sans _f (ancien format) : fusion sans erreur, rien de perdu'); }
{ const vieux = { name: 'Ancien format', tasks: [{ id: 'v1', text: 'a' }], _m: 1.7e12, _f: { name: 1.7e12, tasks: 1.7e12 }, _x: ['z9'] };
  const m = A.fusion(clone(vieux), clone(vieux)); ok(meme(m, vieux), 'données existantes (_m, _f, _x) : fusion avec elles-mêmes sans changement'); }
{ const a = new Appareil(); a.ecrit(() => BASE()); avance(1000); const d1 = { _del: true, _m: T };
  ok(A.fusion(clone(d1), clone(a.doc))._del && !A.fusion(clone(a.doc), { _del: true, _m: T - 1e6 })._del, 'document supprimé : la suppression la plus récente l\'emporte, une suppression plus ancienne non'); }
{ const H = A.horloge(() => 1000); const t1 = H.now(), t2 = H.now(); A.vu(H, { _m: 5000, _f: { x: 1e15 } }); const t3 = H.now();
  ok(t2 > t1 && (A.nom.startsWith('ancienne') || t3 === 5001), 'horloge : toujours croissante, rattrape une heure vue dans le futur proche (' + t3 + '), ignore une heure absurde'); }

console.log('\n-- Propriétés sur des histoires aléatoires (500 tirages) --');
{ let graine = 12345; const hasard = () => { graine = (graine * 1103515245 + 12345) % 2147483648; return graine / 2147483648; };
  const pioche = a => a[Math.floor(hasard() * a.length)]; let n = 0;
  const listes = d => { const L = [['tasks', d.tasks]]; d.rub.forEach(r => { if (r.items) L.push(['items ' + r.id, r.items]); if (r.releves) L.push(['releves ' + r.id, r.releves]); }); return L; };
  const op = (dev, journal) => dev.ecrit(d => { const L = listes(d), r = hasard(), [, l] = pioche(L);
    if (r < 0.3 || !l.length) { const id = 'n' + (n++); l.push(l === d.tasks || !l[0] || 'text' in l[0] ? { id, text: 'Élément ' + id, done: false } : { id, d: '2026-02-01', v: n }); }
    else if (r < 0.5) { const x = pioche(l); x.done = !x.done; x.text = (x.text || '') + '+'; journal.modif.add(String(x.id)); }
    else if (r < 0.65) { const i = Math.floor(hasard() * l.length); journal.suppr.add(String(l[i].id)); l.splice(i, 1); }
    else if (r < 0.8) { const i = Math.floor(hasard() * l.length), x = l[i]; if ('text' in x) { const cibles = L.filter(([, y]) => y !== l && (y === d.tasks || !y[0] || 'text' in y[0])); if (cibles.length) { l.splice(i, 1); pioche(cibles)[1].push(x); journal.dep.add(String(x.id)); } } }
    else if (r < 0.9) { const x = pioche(d.rub); x.name = x.name + '*'; }
    else { l.reverse(); }
    return d; });
  let perte = 0, revenu = 0, nonComm = 0, nonIdem = 0, nonAbs = 0;
  for (let k = 0; k < 500; k++) {
    const [a, b] = deux(Math.floor(hasard() * 3) * 600e3); const ja = { modif: new Set(), suppr: new Set(), dep: new Set() }, jb = { modif: new Set(), suppr: new Set(), dep: new Set() };
    for (let i = 0; i < 1 + Math.floor(hasard() * 6); i++) { { const dv = hasard() < 0.5 ? a : b; op(dv, dv === a ? ja : jb); }; avance(Math.floor(hasard() * 20e3)); }
    /* une partie du temps, A a reçu la version de B avant de continuer */
    if (hasard() < 0.4) { a.recoit(b.doc); for (let i = 0; i < 1 + Math.floor(hasard() * 3); i++) { op(a, ja); avance(Math.floor(hasard() * 20e3)); } }
    const [m1, m2] = lesDeux(a, b);
    if (!meme(m1, m2)) nonComm++;
    if (!meme(A.fusion(clone(m1), clone(m1)), m1)) nonIdem++;
    if (!meme(A.fusion(clone(m1), clone(a.doc)), m1) || !meme(A.fusion(clone(b.doc), clone(m1)), m1)) nonAbs++;
    const vivants = new Set([...ids(a.doc).keys(), ...ids(b.doc).keys()]), apres = ids(m1);
    for (const id of vivants) if (!apres.has(id) && !ja.suppr.has(id) && !jb.suppr.has(id)) perte++;
    /* supprimé d'un côté et ni modifié ni déplacé de l'autre : ne doit pas revenir */
    for (const [j, autre] of [[ja, jb], [jb, ja]]) for (const id of j.suppr) if (apres.has(id) && !autre.modif.has(id) && !autre.dep.has(id) && !j.dep.has(id) && !ids(j === ja ? a.doc : b.doc).has(id)) revenu++;
  }
  ok(!perte, 'aucune perte : tout élément vivant d\'un côté, et que personne n\'a supprimé, est dans la fusion (' + perte + ' perdu(s))');
  ok(!revenu, 'une suppression n\'est pas annulée par l\'autre appareil (' + revenu + ' élément(s) revenu(s))');
  ok(!nonComm, 'commutativité : fusion(A,B) = fusion(B,A) (' + nonComm + ' écart(s) sur 500)');
  ok(!nonIdem, 'idempotence : fusion(M,M) = M (' + nonIdem + ' écart(s))');
  ok(!nonAbs, 'stabilité : refusionner une version déjà intégrée ne change rien (' + nonAbs + ' écart(s))'); }

/* vraies sauvegardes locales (jamais commitées) : seuls des nombres sont affichés */
if (process.env.CARTES) {
  console.log('\n-- Sauvegardes locales --');
  const F = process.env.CARTES.split(/\s+/).filter(Boolean), D = F.map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
  for (let i = 0; i < D.length; i++) for (let j = i; j < D.length; j++) for (const [r, l, sens] of [[D[i], D[j], '→'], [D[j], D[i], '←']]) {
    if (i === j && sens === '←') continue; const t0 = Date.now(); const m = {}; for (const k of new Set([...Object.keys(r), ...Object.keys(l)])) m[k] = A.fusion(clone(r[k]), clone(l[k]));
    /* par document : tout élément de la version la plus récente (avant) doit être dans la fusion (après) */
    const ms = Date.now() - t0; let perdus = 0, docs = 0, repris = 0, avant = 0, apres = 0;
    for (const k of Object.keys(m)) { const rec = !r[k] ? l[k] : !l[k] ? r[k] : ((+r[k]._m || 0) >= (+l[k]._m || 0) ? r[k] : l[k]), vieux = rec === r[k] ? l[k] : r[k];
      if (!m[k] || m[k]._del) { if (rec && !rec._del) { perdus += ids(rec).size; docs++; } continue; }
      const av = rec && !rec._del ? ids(rec) : new Map(), ap = ids(m[k]), vx = vieux && !vieux._del ? ids(vieux) : new Map(); avant += av.size; apres += ap.size;
      let p = 0; for (const id of av.keys()) if (!ap.has(id)) p++; if (p) { perdus += p; docs++; }
      for (const id of vx.keys()) if (!av.has(id) && ap.has(id)) repris++; }
    const idem = i === j ? meme(m, Object.fromEntries(Object.keys(r).map(k => [k, A.fusion(clone(r[k]), clone(r[k]))]))) : true;
    ok(!perdus && idem, path.basename(F[i]) + ' ' + sens + ' ' + path.basename(F[j]) + ' : ' + Object.keys(m).length + ' documents ; éléments de la version la plus récente : ' + avant + ', après fusion : ' + apres + ' ; perdus : ' + perdus + (docs ? ' (dans ' + docs + ' documents)' : '') + ' ; repris de l\'autre version : ' + repris + ' ; ' + ms + ' ms');
  }
}
console.log(ko ? '\n' + ko + ' échec(s)' : '\nTout est bon.'); process.exit(ko ? 1 : 0);
