/* PhotoMarket service worker: ilova qobig'ini keshlaydi, API va yuklangan rasmlarni keshlamaydi */
const CACHE = "pm-shell-v1";
const SHELL = ["/", "/manifest.webmanifest", "/icon-192.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/uploads/")) return;
  if (req.mode === "navigate") {
    // sahifa: avval tarmoq, internet yo'q bo'lsa — keshdagi qobiq
    e.respondWith(fetch(req).catch(() => caches.match("/")));
    return;
  }
  // statik fayllar (hash'li assets): kesh, bo'lmasa tarmoq
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok && (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/photos/"))) { const c = res.clone(); caches.open(CACHE).then((x) => x.put(req, c)); }
    return res;
  })));
});
