const CACHE = "resonance-v1";
const STATIC = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192x192.png",
  "/icon-512x512.png"
];

// Install — cache shell
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network first, fall back to cache
self.addEventListener("fetch", e => {
  // Only handle GET requests
  if (e.request.method !== "GET") return;
  // Skip API calls — always network
  if (e.request.url.includes("/api/")) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
