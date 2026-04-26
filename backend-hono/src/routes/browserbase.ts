// [claude-code 2026-04-25] S42-T5: Browserbase route — POST issues a live
// session URL the frontend ArtifactPane mounts as an iframe; DELETE releases
// the session. Falls back to a screenshot-stream marker when
// BROWSERBASE_API_KEY is missing.

import { Hono } from "hono";
import { z } from "zod";
import { createLogger } from "../lib/logger.js";
import {
  closeSession,
  createSession,
  hasBrowserbaseKey,
  runFallbackScreenshotStream,
} from "../services/browser/browserbase.js";

const log = createLogger("BrowserbaseRoute");

const SessionRequest = z.object({
  task: z.string().min(1).max(2000),
  conversationId: z.string().min(1).max(200).optional(),
});

export function createBrowserbaseRoutes() {
  const app = new Hono();

  app.post("/session", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = SessionRequest.safeParse(body);
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
      const session = await createSession(task);
      return c.json({
        sessionId: session.sessionId,
        sessionUrl: session.sessionUrl,
        conversationId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.warn("session create failed", { error: message });
      return c.json({ error: "browserbase_unavailable", message }, 502);
    }
  });

  app.delete("/session/:id", async (c) => {
    const id = c.req.param("id");
    if (!id) return c.json({ error: "missing_id" }, 400);
    await closeSession(id);
    return c.json({ ok: true });
  });

  return app;
}
