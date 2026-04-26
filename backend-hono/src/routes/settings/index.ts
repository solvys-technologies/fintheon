// [claude-code 2026-04-26] S45.5/F2: removed Rettiwt API key management
//   endpoints (/settings/rettiwt GET/POST/DELETE). Rettiwt is dead code; the
//   user_settings.rettiwt_api_keys column is now unread by the backend.
// [claude-code 2026-04-12] Added Rettiwt API key management endpoints
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
