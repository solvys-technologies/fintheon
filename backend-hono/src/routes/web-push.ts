// [claude-code 2026-04-15] T7: Web push subscription management endpoints
import { Hono, type Context } from "hono";
import { sql, isDatabaseAvailable } from "../config/database.js";
import { sendToUser } from "../services/web-push-sender.js";
import { NOTIFICATION_CATEGORIES } from "../services/notifications/emit.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("WebPush");
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";

function getUserId(c: Context): string | null {
  const userId = c.get("userId") as string | undefined;
  return userId && userId !== "anonymous" ? userId : null;
}

function normalizeCategories(
  categories: Record<string, boolean> | undefined,
): Record<string, boolean> {
  return Object.fromEntries(
    NOTIFICATION_CATEGORIES.map((category) => [
      category,
      categories?.[category] !== false,
    ]),
  );
}

export function createWebPushPublicRoutes(): Hono {
  const router = new Hono();

  router.get("/public-key", (c) => {
    if (!VAPID_PUBLIC_KEY) {
      return c.json({ error: "Web push is not configured" }, 503);
    }
    return c.json({ publicKey: VAPID_PUBLIC_KEY });
  });

  return router;
}

export function createWebPushRoutes(): Hono {
  const router = new Hono();

  // POST /subscribe — register push subscription
  router.post("/subscribe", async (c) => {
    const userId = getUserId(c);
    if (!userId) {
      return c.json({ error: "Auth required" }, 401);
    }
    if (!isDatabaseAvailable()) {
      return c.json({ error: "Database unavailable" }, 503);
    }

    const { subscription, categories, severityThreshold } = await c.req.json<{
      subscription: { endpoint: string; keys: Record<string, string> };
      categories: Record<string, boolean>;
      severityThreshold?: string;
    }>();
    const normalizedCategories = normalizeCategories(categories);

    await sql`
      INSERT INTO web_push_subscriptions (user_id, endpoint, keys, categories, severity_threshold)
      VALUES (${userId}, ${subscription.endpoint}, ${JSON.stringify(subscription.keys)}::jsonb, ${JSON.stringify(normalizedCategories)}::jsonb, ${severityThreshold ?? "medium"})
      ON CONFLICT (endpoint) DO UPDATE SET
        keys = EXCLUDED.keys,
        categories = EXCLUDED.categories,
        severity_threshold = EXCLUDED.severity_threshold,
        user_id = EXCLUDED.user_id,
        updated_at = now()
    `;
    log.info("Subscription registered", { userId });
    return c.json({ ok: true }, 201);
  });

  // DELETE /unsubscribe — remove push subscription
  router.delete("/unsubscribe", async (c) => {
    const userId = getUserId(c);
    if (!userId) {
      return c.json({ error: "Auth required" }, 401);
    }
    const { endpoint } = await c.req.json<{ endpoint: string }>();
    await sql`DELETE FROM web_push_subscriptions WHERE endpoint = ${endpoint} AND user_id = ${userId}`;
    log.info("Subscription removed", { userId });
    return c.json({ ok: true });
  });

  // PATCH /preferences — update categories + severity threshold
  router.patch("/preferences", async (c) => {
    const userId = getUserId(c);
    if (!userId) {
      return c.json({ error: "Auth required" }, 401);
    }
    const { categories, severityThreshold } = await c.req.json<{
      categories: Record<string, boolean>;
      severityThreshold?: string;
    }>();

    if (categories) {
      await sql`
        UPDATE web_push_subscriptions
        SET categories = ${JSON.stringify(normalizeCategories(categories))}::jsonb, updated_at = now()
        WHERE user_id = ${userId}
      `;
    }
    if (severityThreshold) {
      await sql`
        UPDATE web_push_subscriptions
        SET severity_threshold = ${severityThreshold}, updated_at = now()
        WHERE user_id = ${userId}
      `;
    }
    return c.json({ ok: true });
  });

  // POST /test — send test notification
  router.post("/test", async (c) => {
    const userId = getUserId(c);
    if (!userId) {
      return c.json({ error: "Auth required" }, 401);
    }
    try {
      await sendToUser(userId, {
        title: "[TEST] Fintheon",
        body: "Push notifications are working",
        category: "test",
      });
      return c.json({ ok: true });
    } catch (err) {
      log.error("Test push failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return c.json({ error: "Push failed" }, 500);
    }
  });

  return router;
}
