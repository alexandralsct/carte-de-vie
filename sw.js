const C="carte-de-vie-v246";
const FILES=["./","./index.html","./manifest.webmanifest","./manifest-test.webmanifest","./icon-192.png","./icon-512.png","./icon-maskable-512.png","./monde.js","./lecture.js","./reglages.js","./recevoir.js","./connexion.js","./connexion.css","./fonts/instrument-sans.woff2","./fonts/plex-mono-400.woff2","./fonts/plex-mono-500.woff2","./fonts/plex-mono-600.woff2","./fonts/plex-mono-700.woff2","./fonts/plex-mono-400-italique.woff2"];
/* empreintes SHA-256 des fichiers de l'app, écrites par la construction (build_prod.py) avec la version. Le script du service worker
   n'est pas dans le Cache Storage : une autre page du site peut écrire dans ce cache, pas dans ce fichier. Une copie gardée n'est
   donc servie que si son contenu a l'empreinte attendue, et une réponse du réseau n'est rangée que si elle l'a aussi ; ce qui n'a pas
   d'empreinte ici (sw.js, autres fichiers) n'est jamais gardé ni servi depuis le cache. */
const H={"connexion.css":"01bf86c5c909a65f76fd2a55214ead405d8ce57ff1d2d394ab7eac950c8819ce","connexion.js":"c25c5a9ca19236108606957edfcf7049d7c95327873f6b9f06ed4e0664e28b5d","fonts/instrument-sans.woff2":"6219bc4bfdfc5d9b2201dcdf046218b122a758f932e25ed5f168f929b7ca2311","fonts/plex-mono-400-italique.woff2":"2665f5fbbb334780fa135c7f1dc6e2459061a2d6d44c32b7c1fdbc34cde65ede","fonts/plex-mono-400.woff2":"c36f509c0a8f9f85f29cb44bc8701d8a9e0b14c499e77a884f789ead7093a7ac","fonts/plex-mono-500.woff2":"a76f53ca6612e7b3828eec2311098675b7f9849ae4169a8bcef6302aec02a6c0","fonts/plex-mono-600.woff2":"ad4580d8cb4b5f627c2d18457656732f7f7b070f7837fbc380e08054157e6f6c","fonts/plex-mono-700.woff2":"9e1455e6e9c5866f607e464fffb7855486dcf575b7e69b83a3d234e587fce41b","icon-192.png":"a16b74cce22aebabf830478fa637ca639bfa54f483e91c71aea712e1de8dec16","icon-512.png":"dfdccc731a61f99d7c747e05d5aba640424d8ee32132ed04fe2a5c8d55edc7da","icon-maskable-512.png":"5b1c6d0e3c82bf1fd07c8fd504b016b146c37693ab7260446d28be12a02ade4d","index.html":"f7199e7f416787ade1bef6186613213ad53325c2d3cf3aef25793a9772191899","lecture.js":"8279513fcbc6dd92ab99c74abc4a7cea2b7654f8cdb3b9677cc1a0ffd15d7ce4","manifest-test.webmanifest":"12720dcee9857c303df3621a639fa2d360a4e310fbf118a48ad37151f00431c3","manifest.webmanifest":"8d0d147aac5b126eb1ee03e63f7c49389da4e49d8af046dab0023544cd588402","monde.js":"b8a7f37d174b74a29e0f74b3838d830af614f9a7e9ad32fcc6dc189c128adf28","recevoir.js":"d678849485c9019217d5edd514372fa8095314d006a2edfdc8c4a728e705d5d0","reglages.js":"fcfa79eb5843cffcece470cd4658fbedd2fe453515a1d66204ecac78830b0e7b","vendor/tesseract/LICENSE":"c6596eb7be8581c18be736c846fb9173b69eccf6ef94c5135893ec56bd92ba08","vendor/tesseract/core/tesseract-core-lstm.wasm.js":"8f04aa0cc81e7bde33f80e92fa01a7a665f0b4884d098acf5de9c7104a11dfaa","vendor/tesseract/core/tesseract-core-simd-lstm.wasm.js":"ce20eda9533cbed1e6c2b4276fbae1e0adc61b6754b5513084be601787b457cf","vendor/tesseract/lang/fra.traineddata.gz":"d611139672b3752c7097e671e4a1d9209dfd37f2aeb081ef6487fba3351e9255","vendor/tesseract/tesseract.min.js":"a8e29918d098b2b06e1012bdaeffb4aec0445c5d5654709023e0bd1f442a80e8","vendor/tesseract/worker.min.js":"aca1229639fc9907d86f96e825955a2b7c5716d17f3bc3acd71f9c7ab66181fc"};
const PORTEE=new URL(self.registration.scope).pathname;
const cle=u=>{ const x=new URL(u,self.registration.scope); if(x.origin!==location.origin||!x.pathname.startsWith(PORTEE)) return ""; return x.pathname.slice(PORTEE.length)||"index.html"; };
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
const intacte=(r,k)=>!r||!r.ok||!H[k]?Promise.resolve(false):r.clone().arrayBuffer().then(b=>crypto.subtle.digest("SHA-256",b)).then(h=>hex(h)===H[k]).catch(()=>false);
/* installation : les fichiers sont relus sur le réseau (cache:"reload"), jamais dans le cache HTTP du navigateur, qui peut garder
   l'ancienne page quelques minutes après une mise en ligne ; chaque fichier doit avoir son empreinte (sinon, nouvel essai, puis
   l'installation échoue et l'ancienne version reste en place jusqu'au prochain essai du navigateur) */
const charge=(u,n)=>fetch(new Request(u,{cache:"reload"})).then(r=>intacte(r,cle(u)).then(ok=>{ if(ok) return r; if(n>0) return new Promise(t=>setTimeout(t,1500)).then(()=>charge(u,n-1)); throw new Error("empreinte inattendue : "+u); }));
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>Promise.all(FILES.map(u=>charge(u,2).then(r=>c.put(u,r))))).then(()=>self.skipWaiting()));});
/* les adresses avec « ?… » (sw.js?v=…, ?test=1) ne sont jamais gardées : elles rempliraient le cache sans fin ; on retire celles des anciennes versions */
const nettoie=()=>caches.open(C).then(c=>c.keys().then(K=>Promise.all(K.filter(q=>new URL(q.url).search||!H[cle(q.url)]).map(q=>c.delete(q)))));
/* seulement les anciens caches de la carte : les autres apps servies à la même adresse gardent les leurs */
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n.startsWith("carte-de-vie-v")&&n!==C).map(n=>caches.delete(n)))).then(nettoie).then(()=>self.clients.claim()));});
self.addEventListener("fetch",e=>{ const U=new URL(e.request.url); if(e.request.method!=="GET"||U.origin!==location.origin) return;
  /* heure du serveur (recalage de l'horloge de la carte) : toujours le réseau, jamais une copie */
  if(U.searchParams.has("horloge")) return;
  const page=e.request.mode==="navigate"||/\/(index\.html)?(\?.*)?$/.test(U.pathname+U.search)||/sw\.js|manifest/.test(e.request.url);
  const sansQ=!U.search, k=cle(U.origin+U.pathname), connu=!!H[k];
  /* copie gardée : seulement dans le cache de cette version de la carte, et seulement si elle est intacte */
  const verifie=(m,kk)=>m?intacte(m,kk).then(ok=>ok?m:null):null;
  const cache=()=>caches.open(C).then(c=>(connu?c.match(e.request,{ignoreSearch:!sansQ}).then(m=>verifie(m,k)):Promise.resolve(null))
    .then(m=>m||(page&&e.request.mode==="navigate"?c.match("./index.html").then(m2=>verifie(m2,"index.html")):null)));
  const reseau=fetch(page?new Request(e.request.url,{cache:"no-store",credentials:"same-origin"}):e.request).then(r=>{ if(connu&&r.ok&&sansQ&&r.status===200){ const cp=r.clone(); intacte(cp,k).then(ok=>{ if(ok) caches.open(C).then(c=>c.put(e.request,cp)); }); } return r; });
  /* réseau faible : la page attend le réseau 3 s au plus, puis la version gardée s'affiche (la version en ligne est quand même rangée
     dans le cache dès qu'elle arrive, si elle correspond à cette version, et l'app propose de se mettre à jour). Pas de « cache
     d'abord » (stale-while-revalidate) pour la page : la mise à jour automatique recharge l'app dès que sw.js annonce une version plus
     récente ; servie depuis le cache, la page rechargée pourrait encore être l'ancienne, et l'app se rechargerait en boucle. */
  if(!page){ e.respondWith(reseau.catch(()=>cache().then(m=>m||Response.error()))); return; }
  e.respondWith(new Promise(ok=>{ let fini=false; const t=setTimeout(()=>{ cache().then(m=>{ if(m&&!fini){ fini=true; ok(m); } }); },3000);
    reseau.then(r=>{ if(!fini){ fini=true; clearTimeout(t); ok(r); } },()=>{ clearTimeout(t); cache().then(m=>{ if(!fini){ fini=true; ok(m||Response.error()); } }); }); })); });
async function rappels(){ try{ const c=await caches.open("carte-rappels"), r=await c.match("rappels.json"); if(!r) return; const L=await r.json(), v=await c.match("vus.json"), V=new Set(v?await v.json():[]), now=Date.now();
  for(const x of L){ if(x.quand<=now&&now-x.quand<6*3600e3&&!V.has(x.id)){ await self.registration.showNotification(x.titre,{body:x.corps,tag:x.id,icon:"icon-192.png",badge:"icon-192.png",data:{url:x.url||"./"}}); V.add(x.id); } }
  await c.put("vus.json",new Response(JSON.stringify([...V].slice(-300)))); }catch(_){} }
self.addEventListener("periodicsync",e=>{ if(e.tag==="rappels") e.waitUntil(rappels()); });
/* toucher un rappel ouvre la bonne page : l'app déjà ouverte reçoit un message, sinon elle s'ouvre sur l'adresse avec #soir ou #energie */
self.addEventListener("notificationclick",e=>{ e.notification.close(); const u=String((e.notification.data||{}).url||"./"), h=u.includes("#")?u.slice(u.indexOf("#")):"";
  e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(w=>{ for(const c of w){ if("focus" in c){ if(h) c.postMessage({va:h}); return c.focus(); } } return clients.openWindow(/^\.\/(#(soir|energie|assistants|futur|assistant:[a-z0-9_-]{1,40}))?$/i.test(u)?u:"./"); })); });
/* vraies notifications (Web Push, envoyées par le système) : {titre, corps, url:"#…", tag} ; textContent seulement, adresse limitée à l'app */
self.addEventListener("push",e=>{ let d={}; try{ d=e.data?e.data.json():{}; }catch(_){ d={corps:e.data?e.data.text():""}; }
  const h=String(d.url||""), url=/^#[a-z0-9:_-]{1,60}$/i.test(h)?"./"+h:"./";
  e.waitUntil(self.registration.showNotification(String(d.titre||"Ma carte de vie").slice(0,80),{body:String(d.corps||"").slice(0,300),tag:String(d.tag||"carte").slice(0,60),icon:"icon-192.png",badge:"icon-192.png",data:{url}})); });
