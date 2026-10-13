const C="carte-de-vie-v199";
const FILES=["./","./index.html","./manifest.webmanifest","./manifest-test.webmanifest","./icon-192.png","./icon-512.png","./icon-maskable-512.png","./monde.js"];
/* installation : les fichiers sont relus sur le réseau (cache:"reload"), jamais dans le cache HTTP du navigateur, qui peut garder
   l'ancienne page quelques minutes après une mise en ligne ; sinon la nouvelle version rangerait l'ancienne page */
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(FILES.map(u=>new Request(u,{cache:"reload"})))).then(()=>self.skipWaiting()));});
/* les adresses avec « ?… » (sw.js?v=…, ?test=1) ne sont jamais gardées : elles rempliraient le cache sans fin ; on retire celles des anciennes versions */
const nettoie=()=>caches.open(C).then(c=>c.keys().then(K=>Promise.all(K.filter(q=>new URL(q.url).search).map(q=>c.delete(q)))));
/* seulement les anciens caches de la carte : les autres apps servies à la même adresse gardent les leurs */
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n.startsWith("carte-de-vie-v")&&n!==C).map(n=>caches.delete(n)))).then(nettoie).then(()=>self.clients.claim()));});
self.addEventListener("fetch",e=>{ if(e.request.method!=="GET"||new URL(e.request.url).origin!==location.origin) return;
  const page=e.request.mode==="navigate"||/\/(index\.html)?(\?.*)?$/.test(new URL(e.request.url).pathname+new URL(e.request.url).search)||/sw\.js|manifest/.test(e.request.url);
  const sansQ=!new URL(e.request.url).search;
  const cache=()=>caches.match(e.request,{ignoreSearch:!sansQ}).then(m=>m||caches.match("./index.html"));
  const reseau=fetch(page?new Request(e.request.url,{cache:"no-store",credentials:"same-origin"}):e.request).then(r=>{ if(r.ok&&sansQ&&r.status===200){ const cp=r.clone(); caches.open(C).then(c=>c.put(e.request,cp)); } return r; });
  /* réseau faible : la page attend le réseau 3 s au plus, puis la version gardée s'affiche (la version en ligne est quand même rangée
     dans le cache dès qu'elle arrive, et l'app propose de se mettre à jour). Pas de « cache d'abord » (stale-while-revalidate) pour
     la page : la mise à jour automatique recharge l'app dès que sw.js annonce une version plus récente ; servie depuis le cache,
     la page rechargée pourrait encore être l'ancienne, et l'app se rechargerait en boucle jusqu'à ce que le cache soit à jour. */
  if(!page){ e.respondWith(reseau.catch(cache)); return; }
  e.respondWith(new Promise(ok=>{ let fini=false; const t=setTimeout(()=>{ cache().then(m=>{ if(m&&!fini){ fini=true; ok(m); } }); },3000);
    reseau.then(r=>{ if(!fini){ fini=true; clearTimeout(t); ok(r); } },()=>{ clearTimeout(t); cache().then(m=>{ if(!fini){ fini=true; ok(m||Response.error()); } }); }); })); });
async function rappels(){ try{ const c=await caches.open("carte-rappels"), r=await c.match("rappels.json"); if(!r) return; const L=await r.json(), v=await c.match("vus.json"), V=new Set(v?await v.json():[]), now=Date.now();
  for(const x of L){ if(x.quand<=now&&now-x.quand<6*3600e3&&!V.has(x.id)){ await self.registration.showNotification(x.titre,{body:x.corps,tag:x.id,icon:"icon-192.png",badge:"icon-192.png",data:{url:x.url||"./"}}); V.add(x.id); } }
  await c.put("vus.json",new Response(JSON.stringify([...V].slice(-300)))); }catch(_){} }
self.addEventListener("periodicsync",e=>{ if(e.tag==="rappels") e.waitUntil(rappels()); });
/* toucher un rappel ouvre la bonne page : l'app déjà ouverte reçoit un message, sinon elle s'ouvre sur l'adresse avec #soir ou #energie */
self.addEventListener("notificationclick",e=>{ e.notification.close(); const u=String((e.notification.data||{}).url||"./"), h=u.includes("#")?u.slice(u.indexOf("#")):"";
  e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(w=>{ for(const c of w){ if("focus" in c){ if(h) c.postMessage({va:h}); return c.focus(); } } return clients.openWindow(/^\.\/(#(soir|energie))?$/.test(u)?u:"./"); })); });
