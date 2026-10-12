const C="carte-de-vie-v179";
const FILES=["./","./index.html","./manifest.webmanifest","./manifest-test.webmanifest","./icon-192.png","./icon-512.png","./icon-maskable-512.png","./monde.js"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
/* les adresses avec « ?… » (sw.js?v=…, ?test=1) ne sont jamais gardées : elles rempliraient le cache sans fin ; on retire celles des anciennes versions */
const nettoie=()=>caches.open(C).then(c=>c.keys().then(K=>Promise.all(K.filter(q=>new URL(q.url).search).map(q=>c.delete(q)))));
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n!==C&&n!=="carte-rappels").map(n=>caches.delete(n)))).then(nettoie).then(()=>self.clients.claim()));});
self.addEventListener("fetch",e=>{ if(e.request.method!=="GET"||new URL(e.request.url).origin!==location.origin) return;
  const page=e.request.mode==="navigate"||/\/(index\.html)?(\?.*)?$/.test(new URL(e.request.url).pathname+new URL(e.request.url).search)||/sw\.js|manifest/.test(e.request.url);
  const sansQ=!new URL(e.request.url).search;
  e.respondWith(fetch(page?new Request(e.request.url,{cache:"no-store",credentials:"same-origin"}):e.request).then(r=>{ if(r.ok&&sansQ&&r.status===200){ const cp=r.clone(); caches.open(C).then(c=>c.put(e.request,cp)); } return r; }).catch(()=>caches.match(e.request,{ignoreSearch:!sansQ}).then(m=>m||caches.match("./index.html")))); });
async function rappels(){ try{ const c=await caches.open("carte-rappels"), r=await c.match("rappels.json"); if(!r) return; const L=await r.json(), v=await c.match("vus.json"), V=new Set(v?await v.json():[]), now=Date.now();
  for(const x of L){ if(x.quand<=now&&now-x.quand<6*3600e3&&!V.has(x.id)){ await self.registration.showNotification(x.titre,{body:x.corps,tag:x.id,icon:"icon-192.png",badge:"icon-192.png",data:{url:x.url||"./"}}); V.add(x.id); } }
  await c.put("vus.json",new Response(JSON.stringify([...V].slice(-300)))); }catch(_){} }
self.addEventListener("periodicsync",e=>{ if(e.tag==="rappels") e.waitUntil(rappels()); });
/* toucher un rappel ouvre la bonne page : l'app déjà ouverte reçoit un message, sinon elle s'ouvre sur l'adresse avec #soir ou #energie */
self.addEventListener("notificationclick",e=>{ e.notification.close(); const u=String((e.notification.data||{}).url||"./"), h=u.includes("#")?u.slice(u.indexOf("#")):"";
  e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(w=>{ for(const c of w){ if("focus" in c){ if(h) c.postMessage({va:h}); return c.focus(); } } return clients.openWindow(/^\.\/(#(soir|energie))?$/.test(u)?u:"./"); })); });
