// Sky Pointer: keeps a copy of the app on the phone so it opens with no internet.
// The page itself is checked online first (so updates show up), and the saved copy is used when offline.
const C='sky-v3';
const FILES=['./','index.html','icon.png','icon-512.png','manifest.json'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET')return;
  if(u.origin===location.origin&&u.pathname.includes('/sky/fw/'))return;              // updates: always fresh
  if(u.origin===location.origin&&u.pathname.startsWith('/sky/')){
    if(e.request.mode==='navigate'){                                                 // the page: online first, saved copy if offline
      e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(C).then(x=>x.put('index.html',c));return r}).catch(()=>caches.match('index.html')));
      return}
    e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>r||fetch(e.request)));return}
  if(/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)){                          // the fonts: saved once, then used offline
    e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(n=>{const c=n.clone();caches.open(C).then(x=>x.put(e.request,c));return n})));}
});
