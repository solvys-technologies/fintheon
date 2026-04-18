// [claude-code 2026-04-19] Cache-bust to v5.21.4 — TP wasn't seeing new bundles because the SW
//   served the v1 cached assets. activate step nukes any cache name not in the current list.
// [claude-code 2026-04-16] T7: Service worker — push notifications, app shell caching, stale-while-revalidate

const CACHE_NAME = "fintheon-v5.21.5";
const STATIC_CACHE = "fintheon-static-v5.21.5";

// App shell resources to pre-cache on install
const APP_SHELL = ["/", "/index.html"];

// API routes for stale-while-revalidate
const SWR_ROUTES = [
  "/api/riskflow/list",
  "/api/ai/conversations",
  "/api/briefing/latest",
];

// ── Install: pre-cache app shell ──

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

// ── Activate: claim clients, clean old caches ──

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME && k !== STATIC_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ── Fetch: cache strategies ──

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== "GET") return;

  // Static assets (hashed filenames from Vite = immutable) → cache-first
  if (
    url.pathname.startsWith("/assets/") &&
    /\.[a-f0-9]{8,}\./.test(url.pathname)
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(event.request).then(
          (cached) =>
            cached ||
            fetch(event.request).then((res) => {
              cache.put(event.request, res.clone());
              return res;
            }),
        ),
      ),
    );
    return;
  }

  // API routes → stale-while-revalidate
  if (SWR_ROUTES.some((route) => url.pathname.startsWith(route))) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          const networkFetch = fetch(event.request)
            .then((res) => {
              if (res.ok) cache.put(event.request, res.clone());
              return res;
            })
            .catch(() => cached);
          return cached || networkFetch;
        }),
      ),
    );
    return;
  }

  // HTML shell → network-first
  if (
    event.request.mode === "navigate" ||
    url.pathname === "/" ||
    url.pathname === "/index.html"
  ) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/index.html")),
    );
    return;
  }
});

// ── Push notifications ──

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const { title, body, category, url, icon, conversationId } =
    event.data.json();
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url, category, conversationId },
      tag: category,
    }),
  );
});

// ── Notification click: postMessage to client for tab routing ──

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const { url, category, conversationId } = event.notification.data || {};

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      // Try to find an existing window and route via postMessage
      for (const client of clients) {
        if ("focus" in client) {
          client.postMessage({
            type: "notification-tap",
            category: category || "unknown",
            url: url || "/",
            conversationId: conversationId || null,
          });
          return client.focus();
        }
      }
      // No existing window — open one
      return self.clients.openWindow(url || "/");
    }),
  );
});
