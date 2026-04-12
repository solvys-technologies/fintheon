// [claude-code 2026-03-10] User preferences persistence endpoints
// [claude-code 2026-04-12] Added Rettiwt API key management endpoints
import { Hono } from "hono";
import type { Context } from "hono";
import {
  getUserSettings,
  saveUserSettings,
} from "../../services/settings-store.js";
import {
  getSupabaseClient,
  isSupabaseConfigured,
} from "../../config/supabase.js";
import { getPoolStatus } from "../../services/rettiwt-service.js";

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

  // ── Rettiwt API Key Management ────────────────────────────────────────────

  /** GET /api/settings/rettiwt — get user's Rettiwt keys (masked) + pool status */
  router.get("/rettiwt", async (c: Context) => {
    const userId = (c as any).get("userId") as string | undefined;
    if (!userId) return c.json({ error: "Unauthorized" }, 401);
    if (!isSupabaseConfigured())
      return c.json({ error: "DB not configured" }, 500);

    const sb = getSupabaseClient()!;
    const { data, error } = await sb
      .from("user_settings")
      .select("rettiwt_api_keys")
      .eq("user_id", userId)
      .single();

    const keys: string[] = data?.rettiwt_api_keys ?? [];
    // Mask keys for display — show first 8 + last 4 chars
    const masked = keys.map((k: string) =>
      k.length > 16 ? `${k.slice(0, 8)}...${k.slice(-4)}` : "****",
    );

    return c.json({
      keys: masked,
      keyCount: keys.length,
      pool: getPoolStatus(),
    });
  });

  /** POST /api/settings/rettiwt — add a Rettiwt API key */
  router.post("/rettiwt", async (c: Context) => {
    const userId = (c as any).get("userId") as string | undefined;
    if (!userId) return c.json({ error: "Unauthorized" }, 401);
    if (!isSupabaseConfigured())
      return c.json({ error: "DB not configured" }, 500);

    const body = await c.req.json<{ apiKey: string }>().catch(() => null);
    if (!body?.apiKey || body.apiKey.length < 10) {
      return c.json(
        { error: "Invalid API key — must be at least 10 characters" },
        400,
      );
    }

    const sb = getSupabaseClient()!;
    // Get existing keys
    const { data: existing } = await sb
      .from("user_settings")
      .select("rettiwt_api_keys")
      .eq("user_id", userId)
      .single();

    const currentKeys: string[] = existing?.rettiwt_api_keys ?? [];
    if (currentKeys.includes(body.apiKey)) {
      return c.json({ error: "Key already exists" }, 409);
    }

    const updatedKeys = [...currentKeys, body.apiKey];

    // Upsert into user_settings
    const { error } = await sb.from("user_settings").upsert(
      {
        user_id: userId,
        rettiwt_api_keys: updatedKeys,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true, keyCount: updatedKeys.length });
  });

  /** DELETE /api/settings/rettiwt — remove a Rettiwt API key by index */
  router.delete("/rettiwt", async (c: Context) => {
    const userId = (c as any).get("userId") as string | undefined;
    if (!userId) return c.json({ error: "Unauthorized" }, 401);
    if (!isSupabaseConfigured())
      return c.json({ error: "DB not configured" }, 500);

    const body = await c.req.json<{ index: number }>().catch(() => null);
    if (body?.index === undefined || body.index < 0) {
      return c.json({ error: "Invalid index" }, 400);
    }

    const sb = getSupabaseClient()!;
    const { data: existing } = await sb
      .from("user_settings")
      .select("rettiwt_api_keys")
      .eq("user_id", userId)
      .single();

    const currentKeys: string[] = existing?.rettiwt_api_keys ?? [];
    if (body.index >= currentKeys.length) {
      return c.json({ error: "Index out of range" }, 400);
    }

    currentKeys.splice(body.index, 1);

    const { error } = await sb
      .from("user_settings")
      .update({
        rettiwt_api_keys: currentKeys,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true, keyCount: currentKeys.length });
  });

  return router;
}
