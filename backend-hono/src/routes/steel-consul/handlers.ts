// [claude-code 2026-04-26] S45.5/F6: services/browserbase/ → services/steel-consul/.
//   Public route path /api/browserbase/* stays for cache compat; only internal
//   import paths and directory naming are honest now. v5.31.1 already rewrote
//   the implementation to call Steel REST while preserving export shape.
// [claude-code 2026-04-25] S40-P9: /api/browserbase/sessions/* + /stream
// handlers. Auth required — sessions are per-user resources with a daily cap.

import type { Context } from "hono";
import { addClient, removeClient } from "../../services/steel-consul/sse.js";
import {
  closeForUser,
  createForUser,
  getActiveForUser,
  getStats,
  touchActivity,
} from "../../services/steel-consul/session-manager.js";

function userIdOrNull(c: Context): string | null {
  const u = c.get("userId") as string | undefined;
  return u ?? null;
}

export async function handleCreateSession(c: Context) {
  const userId = userIdOrNull(c);
  if (!userId) return c.json({ error: "unauthorized" }, 401);
  const result = await createForUser(userId);
  if (!result.session) {
    return c.json({ error: result.reason ?? "create_failed" }, 503);
  }
  return c.json({
    session: {
      id: result.session.id,
      liveUrl: result.session.liveUrl,
      createdAt: result.session.createdAt,
    },
    stats: getStats(userId),
  });
}

export async function handleCloseSession(c: Context) {
  const userId = userIdOrNull(c);
  if (!userId) return c.json({ error: "unauthorized" }, 401);
  const ok = await closeForUser(userId, "user_close");
  return c.json({ ok, stats: getStats(userId) });
}

export async function handleActiveSession(c: Context) {
  const userId = userIdOrNull(c);
  if (!userId) return c.json({ error: "unauthorized" }, 401);
  const session = getActiveForUser(userId);
  return c.json({
    session: session
      ? {
          id: session.id,
          liveUrl: session.liveUrl,
          createdAt: session.createdAt,
        }
      : null,
    stats: getStats(userId),
  });
}

export async function handleNavigate(c: Context) {
  const userId = userIdOrNull(c);
  if (!userId) return c.json({ error: "unauthorized" }, 401);
  const session = getActiveForUser(userId);
  if (!session) return c.json({ error: "no_active_session" }, 404);
  const body = (await c.req.json().catch(() => ({}))) as { url?: string };
  if (!body.url) return c.json({ error: "url_required" }, 400);
  touchActivity(userId);
  return c.json({
    ok: true,
    sessionId: session.id,
    navigatedTo: body.url,
  });
}

export async function handleExtract(c: Context) {
  const userId = userIdOrNull(c);
  if (!userId) return c.json({ error: "unauthorized" }, 401);
  const session = getActiveForUser(userId);
  if (!session) return c.json({ error: "no_active_session" }, 404);
  touchActivity(userId);
  return c.json({
    ok: true,
    sessionId: session.id,
    hint: "Live extraction is observed via liveUrl iframe; structured pull is via the Browserbase REPL endpoint",
  });
}

export async function handleStream(c: Context) {
  const userId = userIdOrNull(c);
  if (!userId) return c.json({ error: "unauthorized" }, 401);

  const stream = new ReadableStream({
    start(controller) {
      addClient(controller, userId);
      controller.enqueue(
        new TextEncoder().encode(": consul-browser stream open\n\n"),
      );
    },
    cancel(controller) {
      removeClient(controller);
    },
  });

  c.header("Content-Type", "text/event-stream");
  c.header("Cache-Control", "no-cache");
  c.header("Connection", "keep-alive");
  return c.body(stream);
}
