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
    const f = new Function(HTML.slice(i, j) + '\nreturn {mergeDoc,estampille,restampe,creeHorloge,vuDoc,supprime:typeof supprime==="function"?supprime:null};')();
    A = { nom: 'fusion par élément', fusion: f.mergeDoc, ecrire: f.estampille, importer: f.restampe, horloge: f.creeHorloge, vu: f.vuDoc, supprime: f.supprime };
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

console.log('\n-- Audit d\'experts du 13/10 (après-midi) : horloge, listes sans id, import --');
const J = 864e5, B2 = () => { const d = Object.assign(BASE(), { log: [{ t: '2026-01-01T08:00:00Z', m: 'début' }], jeu: { scores: { '2026-01-01': 1 } } }); rub(d, 'r3').gestes[0].days = ['2026-01-01']; return d; };
const deux2 = (da = 0, db = 0) => { const X = new Appareil(); X.ecrit(() => B2()); const a = new Appareil(da), b = new Appareil(db); a.recoit(X.doc); b.recoit(X.doc); avance(1000); return [a, b]; };
const days = d => rub(d, 'r3').gestes[0].days;
{ const [a, b] = deux2(-2 * J, 0); b.ecrit(d => { d.name = 'B'; return d; }); avance(5e3); a.recoit(b.doc); avance(60e3); a.ecrit(d => { d.name = 'A après B'; return d; });
  for (const m of lesDeux(a, b)) ok(m.name === 'A après B', 'N1. horloge en retard de 2 jours : la modification faite APRÈS avoir reçu l\'autre version l\'emporte (' + m.name + ')'); }
{ const [a, b] = deux2(-2 * J, 0); b.ecrit(d => { rub(d, 'r1').items[0].text = 'B'; return d; }); avance(5e3); a.recoit(b.doc); avance(60e3); a.ecrit(d => { rub(d, 'r1').items = []; return d; });
  for (const m of lesDeux(a, b)) ok(!rub(m, 'r1').items.length, 'N1b. horloge en retard de 2 jours : une suppression faite après avoir reçu ne revient pas (' + rub(m, 'r1').items.length + ' restant)'); }
{ const [a, b] = deux2(0, 2 * J); b.ecrit(d => { d.name = 'B'; rub(d, 'r1').items[0].text = 'B'; return d; }); avance(5e3); a.recoit(b.doc); avance(60e3); a.ecrit(d => { d.name = 'A après B'; rub(d, 'r1').items[0].text = 'A'; return d; });
  for (const m of lesDeux(a, b)) ok(m.name === 'A après B' && rub(m, 'r1').items[0].text === 'A', 'N2. un autre appareil avance de 2 jours : ce qui est modifié après avoir reçu sa version l\'emporte (' + m.name + ')'); }
{ const H = A.horloge(() => T - 2 * J); const e = H.recale ? H.recale(T, T - 2 * J) : 0, t = H.now();
  ok(H.recale && Math.abs(t - T) < 5 && Math.abs(e - 2 * J) < 5, 'horloge recalée sur l\'heure du serveur : un appareil en retard de 2 jours écrit à l\'heure du serveur (écart ' + Math.round(e / 36e5) + ' h)');
  const H2 = A.horloge(() => T + 60e3); H2.recale && H2.recale(T, T + 60e3); ok(H2.recale && Math.abs(H2.now() - (T + 60e3)) < 5, 'écart de moins de 5 minutes : l\'horloge de l\'appareil est gardée'); }
{ const [a, b] = deux2(); a.ecrit(d => { d.log.push({ t: '2026-01-02T08:00:00Z', m: 'ajout A' }); days(d).push('2026-01-02'); return d; }); avance(3e3);
  b.ecrit(d => { d.log.push({ t: '2026-01-03T08:00:00Z', m: 'ajout B' }); days(d).push('2026-01-03'); return d; });
  for (const m of lesDeux(a, b)) ok(m.log.length === 3 && days(m).length === 3, 'N3. listes sans id : une ligne de journal et un jour coché de chaque côté sont gardés (log ' + m.log.length + '/3, jours ' + days(m).length + '/3)'); }
{ const [a, b] = deux2(); a.ecrit(d => { days(d).push('2026-01-02'); return d; }); b.recoit(a.doc); avance(2e3); b.ecrit(d => { rub(d, 'r3').gestes[0].days = days(d).filter(x => x !== '2026-01-01'); return d; }); avance(2e3);
  a.ecrit(d => { days(d).push('2026-01-05'); return d; });
  for (const m of lesDeux(a, b)) ok(days(m).join() === '2026-01-02,2026-01-05', 'jour décoché d\'un côté, un autre coché de l\'autre : le décoché ne revient pas (' + days(m).join(' ') + ')'); }
{ const [a, b] = deux2(); a.ecrit(d => { rub(d, 'r3').gestes[0].days = []; return d; }); b.recoit(a.doc); avance(2e3); b.ecrit(d => { days(d).push('2026-01-01'); return d; }); avance(1e3); a.ecrit(d => { d.notes = 'n'; return d; });
  for (const m of lesDeux(a, b)) ok(days(m).join() === '2026-01-01', 'un jour décoché puis recoché ailleurs est gardé (' + days(m).join(' ') + ')'); }
{ const [a, b] = deux2(); a.ecrit(d => { d.log.push({ t: '2026-01-05T08:00:00Z', m: 'ajout de l\'app' }); return d; }); avance(1e3);
  const ext = clone(b.doc); ext.log = [{ t: '2026-01-04T08:00:00Z', m: 'ligne d\'un écrivain externe, sans id' }]; ext._m = T; ext._f = Object.assign({}, ext._f, { log: T });
  for (const m of [A.fusion(clone(ext), clone(a.doc)), A.fusion(clone(a.doc), clone(ext))]) ok(m.log.length === 2 && m.log.some(x => /externe/.test(x.m)) && !m.log.some(x => x.m === 'début'), 'journal tronqué par un écrivain externe qui ajoute une ligne : sa ligne et celle de l\'app sont gardées, la vieille ligne retirée ne revient pas (' + m.log.length + ')'); }
{ const [a, b] = deux2(); a.ecrit(d => { d.jeu.scores['2026-01-02'] = 2; return d; }); avance(3e3); b.ecrit(d => { d.jeu.scores['2026-01-03'] = 3; delete d.jeu.scores['2026-01-01']; return d; });
  for (const m of lesDeux(a, b)) ok(Object.keys(m.jeu.scores).sort().join() === '2026-01-02,2026-01-03', 'N4. dictionnaire par date : un ajout de chaque côté gardé, la clé retirée ne revient pas (' + Object.keys(m.jeu.scores).join(' ') + ')'); }
{ const [a, b] = deux2(); a.ecrit(d => { rub(d, 'r1').items.push({ id: 'i9', text: 'ajout de l\'app', done: false }); return d; }); avance(3e3);
  const ext = clone(b.doc); rub(ext, 'r1').items.push({ text: 'ajout externe sans id', done: false }); ext._m = T; ext._f = Object.assign({}, ext._f, { rub: T });
  for (const m of [A.fusion(clone(ext), clone(a.doc)), A.fusion(clone(a.doc), clone(ext))]) ok(rub(m, 'r1').items.length === 4 && rub(m, 'r1').items.every(x => x.id != null), 'N7. un écrivain externe ajoute un élément sans id : il reçoit un id tiré de son contenu, rien n\'est perdu (' + rub(m, 'r1').items.length + '/4)'); }
{ /* V.202 : meta/semaine (jours avec leurs créneaux) est un instantané : la version la plus récente le remplace, jamais d'union
     (avant : 9 jours, lundi et mardi en double, une copie vide et une copie remplie) */
  const N = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'], sem = (plein, t) => ({ feuille: 'S1', jours: N.map((n, k) => ({ nom: n, date: '2026-01-' + String(5 + k).padStart(2, '0'), creneaux: plein && k < 2 ? [['09:00', 'x', 0]] : [] })), _m: t, _f: { feuille: t, jours: t } });
  const vieille = sem(false, T - 6e4), neuve = sem(true, T);
  for (const m of [A.fusion(clone(vieille), clone(neuve)), A.fusion(clone(neuve), clone(vieille))]) ok(m.jours.length === 7 && new Set(m.jours.map(j => j.date)).size === 7 && m.jours[0].creneaux.length === 1, 'meta/semaine : la semaine la plus récente remplace l\'ancienne, 7 jours sans doublon (' + m.jours.length + ' jours)'); }
if (A.supprime) { const [a, b] = deux2(-2 * J, 0); b.ecrit(d => { d.name = 'B'; return d; }); avance(5e3); a.recoit(b.doc); avance(1e3); const s = A.supprime(a.doc, a.H.now());
  ok(A.fusion(clone(s), clone(b.doc))._del && A.fusion(clone(b.doc), clone(s))._del, 'document supprimé après avoir reçu la dernière version, horloge en retard de 2 jours : la suppression l\'emporte'); }
/* import d'une sauvegarde (comme load() de l'app) : fusion, pas remplacement */
{ const X = new Appareil(); X.ecrit(() => B2()); const sauv = { 'espaces/jardin': clone(X.doc) }; avance(J);
  const enLigne = { 'espaces/jardin': clone(X.doc), 'espaces/nouveau': A.ecrire(null, { name: 'Créé après la sauvegarde', tasks: [{ id: 'n1', text: 'x' }] }, T), 'meta/formations': { liste: [{ id: 'f1', titre: 't' }], _m: T, _f: { liste: T } } }; avance(3600e3);
  const appareil = clone(enLigne), imp = {}; Object.keys(sauv).forEach(k => { imp[k] = A.importer(clone(sauv[k]), T); }); const apres = Object.assign({}, appareil, imp);
  const fin = {}; for (const k of new Set([...Object.keys(apres), ...Object.keys(enLigne)])) fin[k] = A.fusion(clone(enLigne[k]), clone(apres[k]));
  ok(!fin['espaces/nouveau']._del && !fin['meta/formations']._del && fin['espaces/jardin'].name === 'Jardin', 'import d\'une sauvegarde : les documents créés après elle (espace, document du système) sont gardés'); }

console.log('\n-- Propriétés sur des histoires aléatoires (500 tirages) --');
{ let graine = 12345; const hasard = () => { graine = (graine * 1103515245 + 12345) % 2147483648; return graine / 2147483648; };
  const pioche = a => a[Math.floor(hasard() * a.length)]; let n = 0;
  const listes = d => { const L = [['tasks', d.tasks]]; d.rub.forEach(r => { if (r.items) L.push(['items ' + r.id, r.items]); if (r.releves) L.push(['releves ' + r.id, r.releves]); }); return L; };
  const op = (dev, journal) => dev.ecrit(d => { const L = listes(d), r = hasard(), [, l] = pioche(L);
    if (r < 0.3 || !l.length) { const id = 'n' + (n++); l.push(l === d.tasks || !l[0] || 'text' in l[0] ? { id, text: 'Élément ' + id, done: false } : { id, d: '2026-02-01', v: n }); }
    else if (r < 0.5) { const x = pioche(l); x.done = !x.done; x.text = (x.text || '') + '+'; journal.modif.add(String(x.id)); }
    else if (r < 0.65) { const i = Math.floor(hasard() * l.length); journal.suppr.add(String(l[i].id)); l.splice(i, 1); }
    else if (r < 0.8) { const i = Math.floor(hasard() * l.length), x = l[i]; if ('text' in x) { const cibles = L.filter(([, y]) => y !== l && (y === d.tasks || !y[0] || 'text' in y[0])); if (cibles.length) { l.splice(i, 1); pioche(cibles)[1].push(x); journal.dep.add(String(x.id)); } } }
    else if (r < 0.85) { const x = pioche(d.rub); x.name = x.name + '*'; }
    else if (r < 0.9) { const g = d.rub.find(z => z.gestes).gestes[0], j = '2026-02-' + String(1 + Math.floor(hasard() * 9)).padStart(2, '0'); g.days = g.days.includes(j) ? g.days.filter(z => z !== j) : [...g.days, j].sort(); }
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

/* valeurs des listes sans id d'un document (chemin + valeur) : jours cochés, lignes de journal… */
const sansId = d => { const S = new Set(); const w = (v, ch) => { if (Array.isArray(v)) { if (v.length && v.every(x => !x || typeof x !== 'object' || x.id == null)) v.forEach(x => { if (!x || typeof x !== 'object' || !Array.isArray(x)) S.add(ch + '|' + JSON.stringify(x)); }); v.forEach(x => { if (x && typeof x === 'object') w(x, ch + '/' + (x.id != null ? x.id : '')); }); }
  else if (v && typeof v === 'object') Object.keys(v).forEach(c => { if (!/^_/.test(c)) w(v[c], ch + '/' + c); }); }; w(d, ''); return S; };
/* vraies sauvegardes locales (jamais commitées) : seuls des nombres sont affichés */
if (process.env.CARTES) {
  console.log('\n-- Sauvegardes locales --');
  const F = process.env.CARTES.split(/\s+/).filter(Boolean), D = F.map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
  for (let i = 0; i < D.length; i++) for (let j = i; j < D.length; j++) for (const [r, l, sens] of [[D[i], D[j], '→'], [D[j], D[i], '←']]) {
    if (i === j && sens === '←') continue; const t0 = Date.now(); const m = {}; for (const k of new Set([...Object.keys(r), ...Object.keys(l)])) m[k] = A.fusion(clone(r[k]), clone(l[k]));
    /* par document : tout élément de la version la plus récente (avant) doit être dans la fusion (après) */
    const ms = Date.now() - t0; let perdus = 0, docs = 0, repris = 0, avant = 0, apres = 0, sAvant = 0, sPerdus = 0, sRepris = 0;
    for (const k of Object.keys(m)) { const rec = !r[k] ? l[k] : !l[k] ? r[k] : ((+r[k]._m || 0) >= (+l[k]._m || 0) ? r[k] : l[k]), vieux = rec === r[k] ? l[k] : r[k];
      if (!m[k] || m[k]._del) { if (rec && !rec._del) { perdus += ids(rec).size; docs++; } continue; }
      const av = rec && !rec._del ? ids(rec) : new Map(), ap = ids(m[k]), vx = vieux && !vieux._del ? ids(vieux) : new Map(); avant += av.size; apres += ap.size;
      let p = 0; for (const id of av.keys()) if (!ap.has(id)) p++; if (p) { perdus += p; docs++; }
      for (const id of vx.keys()) if (!av.has(id) && ap.has(id)) repris++;
      const sv = sansId(rec && !rec._del ? rec : {}), sm = sansId(m[k]), so = sansId(vieux && !vieux._del ? vieux : {}); sAvant += sv.size;
      for (const c of sv) if (!sm.has(c)) sPerdus++; for (const c of so) if (!sv.has(c) && sm.has(c)) sRepris++; }
    const idem = i === j ? meme(m, Object.fromEntries(Object.keys(r).map(k => [k, A.fusion(clone(r[k]), clone(r[k]))]))) : true;
    ok(!perdus && !sPerdus && idem, path.basename(F[i]) + ' ' + sens + ' ' + path.basename(F[j]) + ' : ' + Object.keys(m).length + ' documents ; éléments de la version la plus récente : ' + avant + ', après fusion : ' + apres + ' ; perdus : ' + perdus + (docs ? ' (dans ' + docs + ' documents)' : '') + ' ; repris de l\'autre version : ' + repris + ' ; valeurs sans id : ' + sAvant + ', perdues : ' + sPerdus + ', reprises : ' + sRepris + ' ; ' + ms + ' ms');
  }
}
/* Plantage du 21-22/10 : un écrivain externe a mis plusieurs éléments au même id dans une liste. Des deux côtés, la fusion
   suivait « après A » vers A et tournait sans fin jusqu'à saturer la mémoire. Elle doit finir vite et ne rien perdre. */
{ const el = (id, c) => ({ id, contenu: c, date: '2026-10-22' });
  const loc = { fil: [el('a', 1), el('f', 2), el('f', 3), el('f', 4), el('b', 5)], _m: 100 };
  const sys = { fil: [el('a', 1), el('e', 6), el('e', 7), el('d', 8), el('d', 9), el('d', 10)], _m: 200 };
  const t0 = Date.now(); let res = null, err = '';
  try { res = A.fusion(clone(sys), clone(loc)); } catch (e) { err = e.message; }
  const dt = Date.now() - t0, n = res && Array.isArray(res.fil) ? res.fil.length : -1;
  ok(!err && dt < 1000 && n > 0 && n <= loc.fil.length + sys.fil.length, 'ids en double des deux côtés : la fusion se termine (' + dt + ' ms, ' + n + ' éléments)' + (err ? ' — ' + err : ''));
  const c = res ? new Set(res.fil.map(x => x.contenu)) : new Set();
  ok([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].every(v => c.has(v)), 'ids en double : aucun élément perdu, d\'un côté comme de l\'autre'); }
console.log(ko ? '\n' + ko + ' échec(s)' : '\nTout est bon.'); process.exit(ko ? 1 : 0);
