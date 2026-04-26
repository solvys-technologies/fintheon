// [claude-code 2026-04-26] S45.5/F6: services/browserbase/ → services/steel-consul/.
//   The directory rename is honest about what's actually running (Steel REST,
//   not the original Browserbase SDK); public route mount stays /api/browserbase/*.
// [claude-code 2026-04-25] S40-P9 + S42-T5 unified: /api/browserbase/* router.
// S40 routes (POST/DELETE/GET on /sessions/*, /stream) drive the persistent
// Consul Browser session. S42 routes (POST/DELETE on /iframe/session) drive
// the transient agent-iframe artifact-pane session — different lifecycle owner
// per S40↔S42 unify brief.

import { Hono } from "hono";
import { z } from "zod";
import { createLogger } from "../../lib/logger.js";
import {
  handleActiveSession,
  handleCloseSession,
  handleCreateSession,
  handleExtract,
  handleNavigate,
  handleStream,
} from "./handlers.js";
import {
  closeSession as closeAgentIframeSession,
  createSession as createAgentIframeSession,
  hasBrowserbaseKey,
  runFallbackScreenshotStream,
} from "../../services/steel-consul/agent-iframe.js";

const log = createLogger("SteelConsulRoute");

const IframeSessionRequest = z.object({
  task: z.string().min(1).max(2000),
  conversationId: z.string().min(1).max(200).optional(),
});

export function createBrowserbaseRoutes(): Hono {
  const router = new Hono();

  // S40-P9 Consul Browser persistent session.
  router.post("/sessions", handleCreateSession);
  router.delete("/sessions/active", handleCloseSession);
  router.get("/sessions/active", handleActiveSession);
  router.post("/sessions/active/navigate", handleNavigate);
  router.post("/sessions/active/extract", handleExtract);
  router.get("/stream", handleStream);

  // S42-T5 agent-iframe transient session (artifact pane).
  router.post("/iframe/session", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = IframeSessionRequest.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "invalid_body", issues: parsed.error.issues },
        400,
      );
    }
    const { task, conversationId } = parsed.data;

    if (!hasBrowserbaseKey()) {
      void runFallbackScreenshotStream(task, conversationId);
      return c.json({ fallback: true, mode: "screenshot-stream" });
    }

    try {
      const session = await createAgentIframeSession(task);
      return c.json({
        sessionId: session.sessionId,
        sessionUrl: session.sessionUrl,
        conversationId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.warn("iframe session create failed", { error: message });
      return c.json({ error: "browserbase_unavailable", message }, 502);
    }
  });

  router.delete("/iframe/session/:id", async (c) => {
    const id = c.req.param("id");
    if (!id) return c.json({ error: "missing_id" }, 400);
    await closeAgentIframeSession(id);
    return c.json({ ok: true });
  });

  return router;
}
