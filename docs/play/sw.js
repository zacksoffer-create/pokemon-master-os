// Offline support: keep the app, the engine and the game files on the phone after the first visit.
const VERSION = "18d376ca67";
const CACHE = "lifeos-story-" + VERSION;
self.addEventListener("install", (e) => {
  self.skipWaiting();
  // straight from the server (not the browser's own cache), so an update never saves yesterday's engine
  const files = ["./", "./index.html", "./engine-worker.js", "./engine.zip", "./pyodide/pyodide.js", "./pyodide/pyodide.asm.js",
    "./pyodide/pyodide.asm.wasm", "./pyodide/python_stdlib.zip", "./pyodide/pyodide-lock.json", "./icon.svg", "./play.webmanifest"];
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(files.map((u) => new Request(u, { cache: "reload" }))).catch(() => {})));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("lifeos-story-") && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// the page, the engine and its worker: always the newest (checked with the server every time the app opens; only the
// changed bytes come down), the saved copy when offline. Everything else (Pyodide, the hashed app files): saved copy first.
const FRESH = /\/(engine\.zip|engine-worker\.js|index\.html|sw\.js)$/;
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  const fresh = e.request.mode === "navigate" || FRESH.test(url.pathname);
  e.respondWith(
    fresh
      // (a page load goes as it is: some phones refuse options on it; the engine files are checked with the server)
      ? (e.request.mode === "navigate" ? fetch(e.request) : fetch(new Request(url.href, { cache: "no-cache" }))).then((r) => {
          if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
          return r;
        }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("./index.html")))
      : caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
          if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
          return r;
        }))
  );
});
