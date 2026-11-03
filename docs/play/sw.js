// Offline support: keep the app, the engine and the game files on the phone after the first visit.
const VERSION = "2e96461eab";
const CACHE = "lifeos-story-" + VERSION;
self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["./", "./index.html", "./engine-worker.js", "./engine.zip",
    "./pyodide/pyodide.js", "./pyodide/pyodide.asm.js", "./pyodide/pyodide.asm.wasm", "./pyodide/python_stdlib.zip",
    "./pyodide/pyodide-lock.json", "./icon.svg", "./play.webmanifest"]).catch(() => {})));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("lifeos-story-") && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // the page itself: network first (so updates arrive), cache when offline; everything else: cache first
  const isPage = e.request.mode === "navigate";
  e.respondWith(
    (isPage ? fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("./index.html")))
      : caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
          if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
          return r;
        })))
  );
});
