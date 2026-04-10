// [claude-code 2026-03-10] User preferences persistence endpoints
import { Hono } from "hono";
import type { Context } from "hono";
import {
  getUserSettings,
  saveUserSettings,
} from "../../services/settings-store.js";

export function createSettingsRoutes(): Hono {
  const router = new Hono();

  /**
   * GET /api/settings — returns user preferences
   */
  router.get("/", async (c: Context) => {
    const userId = (c as any).get("userId") as string | undefined;
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const settings = await getUserSettings(userId);
    return c.json({ settings });
  });

  /**
   * PUT /api/settings — saves user preferences
   */
  router.put("/", async (c: Context) => {
    const userId = (c as any).get("userId") as string | undefined;
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req
      .json<{ settings: Record<string, unknown> }>()
      .catch(() => null);
    if (!body?.settings || typeof body.settings !== "object") {
      return c.json({ error: "Invalid settings payload" }, 400);
    }

    const saved = await saveUserSettings(userId, body.settings);
    return c.json({ settings: saved });
  });

  return router;
}
