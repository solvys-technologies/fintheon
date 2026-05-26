import { Hono } from "hono";
import type { Context } from "hono";
import {
  createProxVoiceToken,
  getPublicVoiceProfile,
} from "../../services/proxvoice/token-service.js";
import { getProxVoiceStatus } from "../../services/proxvoice/global-config.js";
import {
  listPresence,
  updatePresence,
} from "../../services/proxvoice/presence-store.js";

function getUser(c: Context) {
  const userId = c.get("userId") as string | undefined;
  const email = c.get("email") as string | undefined;
  return { userId: userId ?? null, email };
}

export function createProxVoiceRoutes(): Hono {
  const router = new Hono();

  router.get("/status", async (c) => {
    return c.json(await getProxVoiceStatus());
  });

  router.post("/token", async (c) => {
    const { userId, email } = getUser(c);
    if (!userId) return c.json({ error: "Authentication required" }, 401);
    try {
      return c.json(await createProxVoiceToken({ userId, email }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Token failed";
      return c.json({ error: message }, 500);
    }
  });

  router.get("/participants", (c) => {
    return c.json({ participants: listPresence() });
  });

  router.post("/presence", async (c) => {
    const { userId, email } = getUser(c);
    if (!userId) return c.json({ error: "Authentication required" }, 401);
    const body = await c.req.json().catch(() => ({}));
    const profile = await getPublicVoiceProfile({ userId, email });
    const presence = updatePresence({
      profile,
      surface: typeof body.surface === "string" ? body.surface : undefined,
      ticker: typeof body.ticker === "string" ? body.ticker : null,
      sessionId: typeof body.sessionId === "string" ? body.sessionId : null,
      muted: typeof body.muted === "boolean" ? body.muted : undefined,
      deafened: typeof body.deafened === "boolean" ? body.deafened : undefined,
    });
    return c.json({ presence });
  });

  return router;
}
