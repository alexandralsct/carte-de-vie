/**
 * Passerelle « Ma semaine » ⇄ Google Sheets « Tracking Planning » (Apps Script, à coller dans le tableau).
 * - GET  ?cle=…&jour=AAAA-MM-JJ  → la semaine qui contient ce jour, au format de meta/semaine de l'app.
 * - POST {cle, saisies:[{id,j,d,f,c,t}]} → écrit chaque moment dans la bonne feuille (texte, couleur de la catégorie, cases fusionnées).
 * La clé n'est pas dans ce fichier : Paramètres du projet → Propriétés du script → CLE = (un mot de passe à toi).
 * Disposition lue sur S41 : heures en B5:B52 (00:00 → 23:30), lundi → dimanche en C:I, dates en C3:I3 (« 5/10 »), légende en B55:C64.
 */
var L0 = 5, NB = 48, C0 = 3, JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

function sortie(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function cleOk(c) { var k = PropertiesService.getScriptProperties().getProperty('CLE'); return !!k && c === k; }

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (!cleOk(p.cle)) return sortie({ erreur: 'cle' });
  var jour = p.jour || Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd');
  var f = feuilleDuJour(jour);
  if (!f) return sortie({ erreur: 'semaine_introuvable', jour: jour });
  return sortie(lireSemaine(f.feuille, f.dates));
}

function doPost(e) {
  var p = {}; try { p = JSON.parse(e.postData.contents); } catch (x) { return sortie({ erreur: 'json' }); }
  if (!cleOk(p.cle)) return sortie({ erreur: 'cle' });
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try { return sortie({ ok: true, res: (p.saisies || []).map(ecrire) }); } finally { lock.releaseLock(); }
}

/* ---- lecture ---- */
function datesDe(sh, annee) {
  return sh.getRange(3, C0, 1, 7).getDisplayValues()[0].map(function (x) {
    var m = String(x).trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/); if (!m) return '';
    var a = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : String(annee);
    return a + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  });
}
function feuilleDuJour(jour) {
  var a = Number(jour.slice(0, 4)), F = SpreadsheetApp.getActive().getSheets();
  for (var i = 0; i < F.length; i++) for (var d = -1; d <= 1; d++) { var D = datesDe(F[i], a + d); if (D.indexOf(jour) >= 0) return { feuille: F[i], dates: D }; }
  return null;
}
function hexRgb(h) { h = String(h || '').replace('#', ''); if (h.length !== 6) return null; return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16) / 255; }); }
function neutre(c) { return !c || (Math.max.apply(null, c) - Math.min.apply(null, c) < 0.02 && c[0] > 0.9); }
function legende(sh) {
  var bg = sh.getRange(55, 2, 10, 1).getBackgrounds(), v = sh.getRange(55, 3, 10, 1).getDisplayValues(), L = [];
  for (var i = 0; i < 10; i++) { var c = hexRgb(bg[i][0]), n = String(v[i][0]).trim(); if (n && c && !neutre(c)) L.push({ nom: n, hex: bg[i][0], c: c }); }
  return L;
}
function categorie(hex, L) {
  var c = hexRgb(hex); if (neutre(c)) return -1;
  var best = -1, d = 9;
  L.forEach(function (l, k) { for (var t = 0; t <= 0.701; t += 0.05) {
    var x = Math.sqrt(c.reduce(function (s, v, i) { var b = l.c[i] + (1 - l.c[i]) * t; return s + (v - b) * (v - b); }, 0));
    if (x < d) { d = x; best = k; } } });
  return d < 0.08 ? best : -1;
}
function lireSemaine(sh, dates) {
  var L = legende(sh), R = sh.getRange(L0, C0, NB, 7), V = R.getDisplayValues(), B = R.getBackgrounds();
  // une case fusionnée : sa première case donne le texte et la couleur à toutes les autres
  R.getMergedRanges().forEach(function (m) {
    var r0 = m.getRow() - L0, c0 = m.getColumn() - C0;
    for (var r = 0; r < m.getNumRows(); r++) for (var c = 0; c < m.getNumColumns(); c++) {
      var rr = r0 + r, cc = c0 + c; if (rr < 0 || rr >= NB || cc < 0 || cc >= 7) continue;
      if (r0 >= 0 && c0 >= 0) { V[rr][cc] = V[r0][c0]; B[rr][cc] = B[r0][c0]; }
    } });
  var tot = {}, jours = JOURS.map(function (n, k) { return { nom: n, date: dates[k] || '', creneaux: [] }; });
  for (var i = 0; i < NB; i++) for (var k = 0; k < 7; k++) {
    var t = String(V[i][k] || '').trim(), ci = categorie(B[i][k], L);
    if (!t && ci < 0) continue;
    var h = ('0' + Math.floor(i / 2)).slice(-2) + ':' + (i % 2 ? '30' : '00');
    jours[k].creneaux.push([h, t, ci]);
    if (ci >= 0) tot[L[ci].nom] = (tot[L[ci].nom] || 0) + 0.5;
  }
  return { feuille: sh.getName(), debut: dates[0] || '', categories: L.map(function (l) { return { nom: l.nom, hex: l.hex }; }),
           jours: jours, totaux: tot, lu: new Date().toISOString(), source: 'Tracking Planning (passerelle)' };
}

/* ---- écriture : un moment de l'app → cases du tableau ---- */
function ecrire(s) {
  try {
    var f = feuilleDuJour(String(s.j || '')); if (!f) return { id: s.id, ok: false, erreur: 'semaine_introuvable' };
    var k = f.dates.indexOf(s.j), idx = function (h) { var m = String(h).match(/^(\d{1,2}):(\d{2})$/); return m ? Number(m[1]) * 2 + (Number(m[2]) >= 30 ? 1 : 0) : -1; };
    var a = idx(s.d), b = s.f === '24:00' ? NB : idx(s.f);
    if (k < 0 || a < 0 || b <= a) return { id: s.id, ok: false, erreur: 'creneau' };
    var L = legende(f.feuille), l = L.filter(function (x) { return x.nom === s.c; })[0];
    var R = f.feuille.getRange(L0 + a, C0 + k, b - a, 1);
    // une case fusionnée qui chevauche le moment est défaite, et ce qui dépasse au-dessus ou en dessous garde son texte et sa couleur
    R.getMergedRanges().forEach(function (m) {
      var v = m.getCell(1, 1).getDisplayValue(), bg = m.getCell(1, 1).getBackground(), r0 = m.getRow(), r1 = r0 + m.getNumRows(), c = m.getColumn(), w = m.getNumColumns();
      m.breakApart();
      [[r0, L0 + a], [L0 + b, r1]].forEach(function (z) { if (z[1] <= z[0]) return; var P = f.feuille.getRange(z[0], c, z[1] - z[0], w);
        P.setBackground(bg); P.getCell(1, 1).setValue(v); if (z[1] - z[0] > 1 || w > 1) P.merge(); });
    });
    R.clearContent();
    if (b - a > 1) R.merge();
    R.setValue(String(s.t || '').slice(0, 200)).setWrap(true).setVerticalAlignment('top');
    if (l) R.setBackground(l.hex);
    return { id: s.id, ok: true, feuille: f.feuille.getName() };
  } catch (x) { return { id: s.id, ok: false, erreur: String(x).slice(0, 120) }; }
}
