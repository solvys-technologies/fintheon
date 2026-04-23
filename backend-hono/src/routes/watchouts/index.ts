// [claude-code 2026-04-23] S32-T7: GET /api/watchouts — auth-gated silent log
// of calendar-proximity + strategy-drift observations for the Performance tab.

import { Hono } from "hono";
import type { Context } from "hono";
import { listWatchouts } from "../../services/watchouts/watchouts-service.js";

export function createWatchoutsRoutes(): Hono {
  const router = new Hono();

  router.get("/", async (c: Context) => {
    const uid = c.get("supabaseUid") as string | undefined;
    if (!uid) return c.json({ error: "Missing supabase uid" }, 401);

    const from = c.req.query("from") ?? undefined;
    const watchouts = await listWatchouts(uid, from);
    return c.json({ watchouts });
  });

  return router;
}
