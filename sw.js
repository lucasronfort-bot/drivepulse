const CACHE="drivepulse-v3";
const ASSETS=["./", "./index.html", "./style.css", "./app.js", "./manifest.webmanifest", "./audio/synthwave/ambient.wav", "./audio/synthwave/bass.wav", "./audio/synthwave/drums_light.wav", "./audio/synthwave/drums_full.wav", "./audio/synthwave/melody.wav", "./audio/synthwave/accent.wav", "./audio/cinematic/ambient.wav", "./audio/cinematic/bass.wav", "./audio/cinematic/drums_light.wav", "./audio/cinematic/drums_full.wav", "./audio/cinematic/melody.wav", "./audio/cinematic/accent.wav"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener("fetch",e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
