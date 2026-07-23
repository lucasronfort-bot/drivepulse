const CACHE="drivepulse-v8-4";
const CORE=[
 "./",
 "./index.html",
 "./style.css?v=8.4",
 "./app.js?v=8.4",
 "./manifest.webmanifest",
 "./audio/library.json",
 "./audio/kalte-ohren/manifest.json","./audio/kalte-ohren/common/piano.m4a"
];

self.addEventListener("install",event=>{
 self.skipWaiting();
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));
});

self.addEventListener("activate",event=>{
 event.waitUntil(
  caches.keys()
   .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
   .then(()=>self.clients.claim())
 );
});

self.addEventListener("fetch",event=>{
 const request=event.request;
 if(request.method!=="GET")return;

 if(request.mode==="navigate"){
  event.respondWith(
   fetch(request,{cache:"no-cache"})
    .then(response=>{
     const copy=response.clone();
     caches.open(CACHE).then(cache=>cache.put("./index.html",copy));
     return response;
    })
    .catch(()=>caches.match("./index.html"))
  );
  return;
 }

 if(request.url.includes("/audio/")){
  event.respondWith(
   caches.open(CACHE).then(async cache=>{
    const cached=await cache.match(request);
    if(cached)return cached;
    const response=await fetch(request);
    if(response.ok)cache.put(request,response.clone());
    return response;
   })
  );
  return;
 }

 event.respondWith(
  caches.match(request).then(cached=>cached||fetch(request).then(response=>{
   if(response.ok)caches.open(CACHE).then(cache=>cache.put(request,response.clone()));
   return response;
  }))
 );
});
