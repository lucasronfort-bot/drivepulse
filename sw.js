const CACHE="drivepulse-v4";
const ASSETS=["./", "./index.html", "./style.css", "./app.js", "./manifest.webmanifest", "./audio/synthwave/ambient.wav", "./audio/synthwave/bass_low.wav", "./audio/synthwave/bass_high.wav", "./audio/synthwave/drums_calm.wav", "./audio/synthwave/drums_drive.wav", "./audio/synthwave/drums_boost.wav", "./audio/synthwave/melody_a.wav", "./audio/synthwave/melody_b.wav", "./audio/synthwave/transition.wav"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener("fetch",e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
