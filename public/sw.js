// CataLog Service Worker — production-quality PWA
// Cache version: bump this to bust old caches on deploy
const CACHE_VERSION = "catalog-v2";
const RUNTIME_CACHE = "catalog-runtime-v2";

// App shell assets to pre-cache on install
const APP_SHELL = [
  "/",
  "/index.html",
  "/favicon.svg",
  "/manifest.json",
];

// ─── Install: pre-cache app shell ───
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return Promise.allSettled(
        APP_SHELL.map((url) =>
          cache.add(url).catch((err) => {
            console.warn("SW: failed to cache", url, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ─── Activate: clean old caches, claim clients ───
self.addEventListener("activate", (event) => {
  const validCaches = [CACHE_VERSION, RUNTIME_CACHE];
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => !validCaches.includes(n))
          .map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch: smart strategies ───
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== "GET") return;

  // Skip non-http(s) requests (chrome-extension://, etc.)
  if (!url.protocol.startsWith("http")) return;

  // ── API calls: network-first, with offline fallback ──
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstWithOffline(request));
    return;
  }

  // ── Static assets (JS, CSS, fonts, images): cache-first ──
  if (
    url.pathname.match(/\.(js|css|woff2?|png|jpg|jpeg|gif|svg|ico)$/) ||
    url.pathname.startsWith("/assets/")
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // ── Navigation / HTML requests: network-first, fall back to app shell ──
  if (request.mode === "navigate") {
    event.respondWith(networkFirstWithShell(request));
    return;
  }

  // ── Everything else: stale-while-revalidate ──
  event.respondWith(staleWhileRevalidate(request));
});

// ─── Strategies ───

/** Cache-first: serve from cache, update cache in background */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    // Background refresh
    fetch(request)
      .then((response) => {
        if (response.ok) {
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, response));
        }
      })
      .catch(() => {});
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
    }
    return response;
  } catch {
    return new Response("Offline", { status: 503 });
  }
}

/** Network-first: try network, fall back to cache, then JSON error */
async function networkFirstWithOffline(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    // Return a JSON error the app can display
    return new Response(
      JSON.stringify({ error: "You are offline", offline: true }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

/** Network-first for navigation: fall back to cached app shell */
async function networkFirstWithShell(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
    }
    return response;
  } catch {
    // Try to serve the cached version of this exact URL
    const cached = await caches.match(request);
    if (cached) return cached;

    // Fall back to /index.html (for SPAs)
    const shell = await caches.match("/");
    if (shell) return shell;

    return new Response("Offline — please check your connection", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

/** Stale-while-revalidate: serve cached, update from network */
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
      }
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}
