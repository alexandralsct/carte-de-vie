/* Menu ••• de la variante « style LIFE » : même place et même forme que le menu de LIFE.
   Il ne fait que relayer les boutons existants de la carte (clic sur le bouton d'origine), sans rien changer à leurs actions. */
(function () {
  'use strict';
  var hd = document.querySelector('header');
  if (!hd || document.getElementById('lifePlus')) return;

  var b = document.createElement('button');
  b.id = 'lifePlus';
  b.type = 'button';
  b.title = 'Plus';
  b.setAttribute('aria-label', "Plus d'options");
  b.setAttribute('aria-haspopup', 'menu');
  b.setAttribute('aria-expanded', 'false');
  b.textContent = '•••';

  var m = document.createElement('div');
  m.id = 'lifeMenu';
  m.setAttribute('role', 'menu');
  m.hidden = true;

  var groupes = [
    ['Carte', [['Réglages', 'setBtn'], ['Chercher', 'chercheBtn'], ['Mes notes', 'notesBtn3'], ["Mes idées pour l'app", 'sugBtn']]],
    ['Aller à', [['Moi', '.moi']]]
  ];

  function ferme() {
    m.hidden = true;
    b.setAttribute('aria-expanded', 'false');
  }

  groupes.forEach(function (g) {
    var d = document.createElement('div');
    d.className = 'grp';
    d.setAttribute('role', 'group');
    d.setAttribute('aria-label', g[0]);
    var t = document.createElement('span');
    t.className = 'grp-t';
    t.setAttribute('aria-hidden', 'true');
    t.textContent = g[0];
    d.appendChild(t);
    g[1].forEach(function (it) {
      var x = document.createElement('button');
      x.type = 'button';
      x.setAttribute('role', 'menuitem');
      x.textContent = it[0];
      x.addEventListener('click', function () {
        var cible = it[1].charAt(0) === '.' ? document.querySelector(it[1]) : document.getElementById(it[1]);
        ferme();
        if (cible) cible.click();
      });
      d.appendChild(x);
    });
    m.appendChild(d);
  });

  b.addEventListener('click', function (e) {
    e.stopPropagation();
    var ouvre = m.hidden;
    m.hidden = !ouvre;
    b.setAttribute('aria-expanded', String(ouvre));
  });
  document.addEventListener('click', function (e) {
    if (!m.contains(e.target) && e.target !== b) ferme();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') ferme();
  });

  hd.appendChild(b);
  hd.appendChild(m);
})();
