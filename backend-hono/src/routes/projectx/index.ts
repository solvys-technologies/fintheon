import { Hono } from "hono";
import type { Context } from "hono";
import {
  ProjectXConnectSchema,
  ProjectXSyncSchema,
  ProjectXTradesQuerySchema,
} from "../../services/projectx-gateway/types.js";
import { saveProjectXCredentials } from "../../services/projectx-gateway/credentials.js";
import {
  listProjectXTrades,
  syncProjectXForUser,
} from "../../services/projectx-gateway/sync.js";
import { getProjectXStatus } from "../../services/projectx-gateway/status.js";

function userId(c: Context): string | null {
  const value = c.get("userId") as string | undefined;
  if (!value || value === "anonymous") return null;
  return value;
}

export function createProjectXRoutes() {
  const app = new Hono();

  app.get("/status", async (c) => {
    const uid = userId(c);
    if (!uid) return c.json({ error: "Authentication required" }, 401);
    return c.json(await getProjectXStatus(uid));
  });

  app.post("/connect", async (c) => {
    const uid = userId(c);
    if (!uid) return c.json({ error: "Authentication required" }, 401);
    const parsed = ProjectXConnectSchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const result = await saveProjectXCredentials(uid, parsed.data);
    const sync = await syncProjectXForUser(uid, { mode: "manual" });
    const success = sync.success === true;
    const status = sync.httpStatus === 429 ? 429 : success ? 200 : 400;
    return c.json({ success, ...result, sync }, status);
  });

  app.post("/sync", async (c) => {
    const uid = userId(c);
    if (!uid) return c.json({ error: "Authentication required" }, 401);
    const parsed = ProjectXSyncSchema.safeParse(
      await c.req.json().catch(() => ({})),
    );
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const result = await syncProjectXForUser(uid, parsed.data);
    if (result.status === "rate_limited") return c.json(result, 429);
    if (result.success === false && result.status === "needs_credentials") {
      return c.json(result, 400);
    }
    return c.json(result);
  });

  app.get("/trades", async (c) => {
    const uid = userId(c);
    if (!uid) return c.json({ error: "Authentication required" }, 401);
    const parsed = ProjectXTradesQuerySchema.safeParse(c.req.query());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const trades = await listProjectXTrades(uid, parsed.data);
    return c.json({
      trades,
      from: parsed.data.from,
      to: parsed.data.to,
      source: "projectx",
    });
  });

  return app;
}
