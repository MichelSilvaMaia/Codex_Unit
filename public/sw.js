const CACHE = "codex-unit-shell-v1";
const ASSETS = ["/offline.html", "/pwa/icon-192.png", "/pwa/icon-512.png"];
self.addEventListener("message", event => { if (event.data?.type === "SKIP_WAITING") self.skipWaiting(); });
self.addEventListener("install", event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))); });
self.addEventListener("activate", event => { event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("codex-unit-shell-") && key !== CACHE).map(key => caches.delete(key)))), self.clients.claim()])); });
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/login") || url.pathname.startsWith("/select-tenant")) return;
  if (ASSETS.includes(url.pathname) || url.pathname.startsWith("/_next/static/")) {
    event.respondWith(caches.open(CACHE).then(async cache => { const saved = await cache.match(request); if (saved) return saved; const response = await fetch(request); if (response.ok) cache.put(request, response.clone()); return response; }));
    return;
  }
  if (request.mode === "navigate") event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
});
