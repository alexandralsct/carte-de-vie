/* Tests de non-régression de « Ma carte de vie », à lancer avant chaque mise en ligne.
   Usage : python3 -m http.server 8767 (à la racine du dépôt), puis
           CARTE=/chemin/vers/carte.json node tests/regression.mjs
   CARTE : une sauvegarde de la carte (export depuis Réglages). Sans CARTE, la carte de démonstration est utilisée.
   CHROMIUM : chemin du navigateur si Playwright ne le trouve pas. */
import { chromium, devices } from 'playwright';
const URL=process.env.URL||'http://localhost:8767/index.html', CARTE=process.env.CARTE;
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
let ko=0; const ok=(c,m)=>{ console.log((c?'OK  ':'KO  ')+m); if(!c) ko++; };
const ouvre=async(vp)=>{ const ctx=await b.newContext(Object.assign({},devices['Galaxy S9+'],{viewport:vp||{width:412,height:915},serviceWorkers:'block'})); const p=await ctx.newPage(); const err=[]; p.on('pageerror',e=>err.push(e.message));
  await p.goto(URL); await p.evaluate(()=>{ ['hRap','compagnon','mouvements'].forEach(k=>localStorage.setItem(k,'0')); localStorage.setItem('carte-de-vie-vu','1'); }); await p.reload();
  if(CARTE) await p.setInputFiles('#impFile',CARTE); await p.waitForTimeout(1500); return {ctx,p,err,cdp:await ctx.newCDPSession(p)}; };
const item=(p,n)=>p.evaluate(n=>{ const x=[...document.querySelectorAll('.node')].find(x=>{ const t=x.querySelector('b'); return t&&t.textContent.replace(/\s+/g,' ').trim()===n; }); if(x) x.click(); return !!x; },n);
const ferme=p=>p.evaluate(()=>document.getElementById('closeBtn').click());
const sel=p=>p.evaluate(()=>[...document.querySelectorAll('#pane .rpt')].findIndex(b=>b.getAttribute('aria-selected')==='true'));
const glisse=async(cdp,p,x0,y0,x1,y1,ms=250,attente=0)=>{ const n=14; await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x0,y:y0}]}); if(attente) await p.waitForTimeout(attente); for(let i=1;i<=n;i++){ await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x0+(x1-x0)*i/n,y:y0+(y1-y0)*i/n}]}); await p.waitForTimeout(ms/n); } await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await p.waitForTimeout(900); };

{ const {ctx,p,err,cdp}=await ouvre();
  const noms=await p.evaluate(()=>[...document.querySelectorAll('.node b')].map(x=>x.textContent.replace(/\s+/g,' ').trim()).filter(Boolean));
  ok(noms.length>3,'la carte affiche '+noms.length+' items');
  /* 1. swipe des pages dans chaque item, au milieu du contenu, lent et rapide */
  for(const n of noms){ await item(p,n); await p.waitForTimeout(500); const np=await p.evaluate(()=>document.querySelectorAll('#pane .rpage').length); if(np<2){ await ferme(p); continue; }
    let bloque=0; for(const ms of [220,900]){ await p.evaluate(()=>{ const tr=document.querySelector('#pane .rptrack'); tr.scrollTo({left:0}); const d=document.getElementById('drawer'); d.scrollTop=tr.getBoundingClientRect().top+d.scrollTop-160; }); await p.waitForTimeout(400);
      const y=await p.evaluate(()=>{ const r=document.querySelector('#pane .rptrack').getBoundingClientRect(); return Math.min(innerHeight-60,r.top+Math.min(220,r.height/2)); }); await glisse(cdp,p,370,y,60,y+4,ms); if(await sel(p)!==1) bloque++; }
    ok(!bloque,'swipe des pages dans « '+n+' » ('+np+' pages)'); await ferme(p); await p.waitForTimeout(250); }
  /* 2. Habitudes : cocher une case ne casse rien et reste rapide */
  if(noms.includes('Habitudes')){ await item(p,'Habitudes'); await p.waitForTimeout(600); const t=await p.evaluate(()=>{ const a=performance.now(); document.querySelector('.hcase').click(); return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(performance.now()-a)))); }); ok(t<400,'cocher une habitude : '+Math.round(t)+' ms'); await ferme(p); await p.waitForTimeout(300); }
  /* 3. couleur d'un item */
  const nc=noms.includes('Immobilier')?'Immobilier':noms.find(n=>n!=='À traiter'); await item(p,nc); await p.waitForTimeout(600); await p.evaluate(()=>document.querySelector('.swcur').scrollIntoView({block:'center'})); await p.tap('.swcur'); await p.waitForTimeout(300); const ouvert=await p.evaluate(()=>document.querySelector('#sw .pick').classList.contains('open')); ok(ouvert,'le choix de couleur s\'ouvre');
  if(ouvert){ await p.tap('#sw .pick button:nth-child(2)'); await p.waitForTimeout(400); ok(await p.evaluate(()=>!!getComputedStyle(document.querySelector('.swcur')).getPropertyValue('--c')),'la couleur s\'applique'); } await ferme(p); await p.waitForTimeout(300);
  /* 4. onglets de pages déplaçables (appui long) */
  const avec=[]; for(const n of noms){ await item(p,n); await p.waitForTimeout(400); const k=await p.evaluate(()=>document.querySelectorAll('#pane .rpt').length); if(k>=3){ avec.push(n); break; } await ferme(p); await p.waitForTimeout(200); }
  if(avec.length){ const avant=await p.evaluate(()=>[...document.querySelectorAll('#pane .rpt')].map(x=>x.textContent).join('|')); const pos=await p.evaluate(()=>{ const t=[...document.querySelectorAll('#pane .rpt')]; const d=document.getElementById('drawer'); d.scrollTop=t[0].getBoundingClientRect().top+d.scrollTop-300; const a=t[2].getBoundingClientRect(), z=t[1].getBoundingClientRect(); return [a.left+a.width/2,a.top+a.height/2,z.left+6]; });
    await glisse(cdp,p,pos[0],pos[1],pos[2],pos[1]+2,400,550); const apres=await p.evaluate(()=>[...document.querySelectorAll('#pane .rpt')].map(x=>x.textContent).join('|')); ok(avant!==apres,'déplacer un onglet de page dans « '+avec[0]+' »'); await ferme(p); await p.waitForTimeout(300); }
  /* 5. Cuisine : recette → ingrédients */
  if(noms.includes('Cuisine')){ await item(p,'Cuisine'); await p.waitForTimeout(600); const i=await p.evaluate(()=>{ const t=[...document.querySelectorAll('#pane .rpt')]; const i=t.findIndex(x=>/courses/i.test(x.textContent)); if(i>=0) t[i].click(); return i; }); await p.waitForTimeout(800);
    if(i>=0){ for(const [q,attendu] of [['Curry de légumes','Lait de coco'],['Pâtes au pesto','Basilic'],['Tarte aux pommes','Pommes'],['Bao','Porc'],['Sauce bao','Sauce hoisin'],['Bao poulet','Poulet'],['Bao sans porc','Poulet'],['Lasagnes sans gluten','sans gluten']]){ await p.fill('#fRecette',q); await p.click('.crsrecf button'); await p.waitForTimeout(500); const L=await p.evaluate(()=>[...document.querySelectorAll('.crsing li .txt')].map(x=>x.textContent).join(', ')); ok(L.includes(attendu),'recette « '+q+' » → '+attendu); const an=await p.$('.crsrec .crsbar .btn.ghost'); if(an) await an.click(); await p.waitForTimeout(300); } } await ferme(p); }
  ok(!err.length,'aucune erreur JavaScript'+(err.length?' : '+err.slice(0,3).join(' / '):''));
  await ctx.close(); }
/* 5 bis. toutes les recettes du carnet sont reconnues, même avec « de », « au », « aux » */
{ const {ctx,p}=await ouvre(); const ko=await p.evaluate(()=>{ const R=window._rec; if(!R) return ['_rec absent']; return Object.keys(R.base).filter(n=>{ const a=R.analyse(n); return a.type!=="base"||a.autres.length; }); }); ok(!ko.length,'carnet de recettes : toutes reconnues'+(ko.length?' (sauf '+ko.join(', ')+')':'')); await ctx.close(); }
/* 6. ordinateur (1280 px) : la carte et un item s'affichent sans erreur */
{ const {ctx,p,err}=await ouvre({width:1280,height:900}); const n=await p.evaluate(()=>document.querySelectorAll('.node').length); ok(n>3,'Mac : la carte s\'affiche'); const nom=await p.evaluate(()=>{ const t=document.querySelector('.node b'); return t&&t.textContent.replace(/\s+/g,' ').trim(); }); await item(p,nom); await p.waitForTimeout(600); ok(await p.evaluate(()=>!document.getElementById('drawer').hidden),'Mac : un item s\'ouvre'); ok(!err.length,'Mac : aucune erreur JavaScript'); await ctx.close(); }
console.log(ko?ko+' échec(s)':'Tout est bon.'); await b.close(); process.exit(ko?1:0);
