const CACHE = "wellness-v5";
const ASSETS = [
  "/",
  "/manifest.json",
  "/icon-192x192.png",
  "/icon-512x512.png",
  "/brand/fcl.svg",
];

// Install: cache a current offline app shell.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Activate: remove every cache from older releases.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || !event.request.url.startsWith(self.location.origin)) return;

  // Always check the network first for page navigations. This prevents an
  // installed app from reopening an older release such as testing mode.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match(event.request).then((cached) => cached || caches.match("/")))
    );
    return;
  }

  // Versioned static assets can remain cache-first for fast repeat visits.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
