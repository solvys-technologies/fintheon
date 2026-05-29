// [claude-code 2026-04-25] S35-Unified v5.27.0: cross-device clear/read sync. The backend
//   sends a category="__sync" push when one device clears/reads/changes prefs; the SW
//   suppresses any visible notification, removes any matching shown notifications by tag
//   (so a clear on desktop wipes the lock-screen bubble on mobile), and broadcasts a
//   "fintheon:sync" client message so the React app refetches /api/notifications.
// [claude-code 2026-04-19] S26-P2 T9 v5.26.1: lock-screen dispatch for maintenance_request
//   (commit / deploy / deny → POST /api/maintenance/decision). When a push arrives with
//   category "maintenance_request" the SW carries a requestId into the notification data
//   and renders up to 2 of the 3 actions per OS limit; tapping the notification (no action)
//   routes into the app like any other category.
// [claude-code 2026-04-19] S25 v5.22.0: SOTA push — rich media (image), lock-screen actions
//   (Approve/Deny/Open), per-item tags (approvals stack, riskflow collapses), badge counter
//   via setAppBadge + SW-local counter in memory, and an `event.action` branch that fires a
//   no-auth POST /api/tool-decision-quick when the user taps Approve/Deny without opening
//   the app.
// [claude-code 2026-04-19] Cache-bust to v5.21.4 — TP wasn't seeing new bundles because the SW
//   served the v1 cached assets. activate step nukes any cache name not in the current list.
// [claude-code 2026-04-16] T7: Service worker — push notifications, app shell caching, stale-while-revalidate

const CACHE_NAME = "fintheon-v7.0.7-surface-routing";
const STATIC_CACHE = "fintheon-static-v7.0.7-surface-routing";

// App shell resources to pre-cache on install
const APP_SHELL = ["/", "/index.html"];

// API routes for stale-while-revalidate
const SWR_ROUTES = [
  "/api/riskflow/list",
  "/api/ai/conversations",
  "/api/briefing/latest",
];

// [S25] SW-local unread counter. Reset via client message {type:'clear-badge'}.
let swUnread = 0;

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
      caches.open(CACHE_NAME).then((cache) =>
        fetch(event.request)
          .then((res) => {
            if (res.ok) cache.put("/index.html", res.clone());
            return res;
          })
          .catch(() => caches.match("/index.html")),
      ),
    );
    return;
  }
});

// ── Push notifications ──

async function broadcastSyncToClients(sync) {
  // Forward the sync event to every open client so the React app refetches.
  const all = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  for (const client of all) {
    try {
      client.postMessage({ type: "fintheon:sync", ...sync });
    } catch {
      // ignore — client might be in the middle of unloading
    }
  }
}

async function handleSyncEvent(sync) {
  // sync = { kind, id?, originEndpoint?, updatedAt }
  // We don't know our own endpoint, so skipping by originEndpoint requires the
  // app shell to filter — at SW level we just always replay. The cost is one
  // extra refetch on the originating device; acceptable.
  if (!sync || typeof sync.kind !== "string") return;

  // For *_all kinds, wipe every visible notification (other than __sync, which
  // never shows) and zero the badge.
  if (
    sync.kind === "notifications.cleared_all" ||
    sync.kind === "notifications.read_all"
  ) {
    const shown = await self.registration.getNotifications();
    for (const n of shown) {
      // Don't close approvals/maintenance modals — they need explicit action,
      // not a passive "read" sweep.
      if (
        n.tag &&
        (n.tag.startsWith("toolApprovals:") ||
          n.tag.startsWith("maintenance_request:"))
      ) {
        continue;
      }
      n.close();
    }
    swUnread = 0;
    if (typeof self.registration.clearAppBadge === "function") {
      self.registration.clearAppBadge().catch(() => {});
    }
  }

  // For a single-id clear/read, find the matching shown notification by tag suffix.
  if (sync.kind === "notification.cleared" && sync.id) {
    const shown = await self.registration.getNotifications();
    for (const n of shown) {
      if (n.tag && n.tag.endsWith(`:${sync.id}`)) n.close();
    }
    if (swUnread > 0) {
      swUnread -= 1;
      if (typeof self.registration.setAppBadge === "function") {
        self.registration.setAppBadge(swUnread).catch(() => {});
      }
    }
  }

  await broadcastSyncToClients(sync);
}

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data;
  try {
    data = event.data.json();
  } catch {
    return;
  }

  // Silent cross-device sync push — never renders a notification.
  if (data.category === "__sync") {
    event.waitUntil(handleSyncEvent(data.sync));
    return;
  }

  const {
    title,
    body,
    category,
    url,
    icon,
    image,
    actions,
    conversationId,
    itemId,
    approvalId,
    requestId,
  } = data;

  // [S25/S26] Per-item tag so approvals stack (user sees multiple pending decisions)
  //       while noisy riskflow storms collapse under a single `riskflow` tag.
  //       Maintenance requests use requestId as their tag key so each stacks.
  let tag = category || "default";
  if (category === "toolApprovals" && approvalId) {
    tag = `toolApprovals:${approvalId}`;
  } else if (category === "maintenance_request" && requestId) {
    tag = `maintenance_request:${requestId}`;
  } else if (category === "chat_relay" && conversationId) {
    tag = `chat_relay:${conversationId}`;
  } else if (itemId && category !== "riskflow") {
    tag = `${category}:${itemId}`;
  }

  // Bump badge if the platform supports it (iOS 16.4+, Android Chrome PWA)
  swUnread += 1;
  if (typeof self.registration.setAppBadge === "function") {
    self.registration.setAppBadge(swUnread).catch(() => {});
  }

  const options = {
    body: body || "",
    icon: icon || "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: {
      url,
      category,
      conversationId,
      itemId,
      approvalId,
      requestId,
    },
    tag,
    renotify: true,
    // Hero image for rich push (iOS 16.4+/Android)
    ...(image ? { image } : {}),
    // Lock-screen action buttons
    ...(Array.isArray(actions) && actions.length > 0
      ? { actions: actions.slice(0, 2) }
      : {}),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click: either resolve the approval inline OR route into the app ──

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const action = event.action || "";
  const { url, category, conversationId, approvalId, requestId } = data;

  // [S25] Lock-screen Approve/Deny — no-auth POST to the quick-decision endpoint,
  //       approval-id-as-secret. Window is 10 min; handler enforces freshness.
  if (
    (action === "approve" || action === "deny") &&
    approvalId &&
    category === "toolApprovals"
  ) {
    const decision = action === "approve" ? "approved" : "denied";
    event.waitUntil(
      fetch("/api/tool-decision-quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalId, decision }),
      }).catch(() => {
        // Silent fail — user can still open the app to decide
      }),
    );
    return;
  }

  // [S26-P2 T9] Lock-screen Commit / Deploy / Deny for maintenance_request. This posts
  //   directly to /api/maintenance/decision. Super-admin gate runs server-side — if the
  //   SW's session token is missing or non-admin the call returns 401/403 and the user
  //   has to open the app to re-auth. That's the intended failure mode.
  if (
    (action === "approve_commit" ||
      action === "approve_deploy" ||
      action === "deny") &&
    requestId &&
    category === "maintenance_request"
  ) {
    const mapped =
      action === "approve_commit"
        ? "approve_commit"
        : action === "approve_deploy"
          ? "approve_and_deploy"
          : "deny";
    event.waitUntil(
      fetch("/api/maintenance/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action: mapped }),
      }).catch(() => {
        /* silent — user can open the app */
      }),
    );
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.postMessage({
            type: "notification-tap",
            category: category || "unknown",
            url: url || "/",
            conversationId: conversationId || null,
            requestId: requestId || null,
          });
          return client.focus();
        }
      }
      return self.clients.openWindow(url || "/");
    }),
  );
});

// ── Client messages — clear badge on mark-all-read ──

self.addEventListener("message", (event) => {
  if (event.data?.type === "clear-badge") {
    swUnread = 0;
    if (typeof self.registration.clearAppBadge === "function") {
      self.registration.clearAppBadge().catch(() => {});
    }
  }
});
