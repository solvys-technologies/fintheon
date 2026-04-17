// [claude-code 2026-04-17] S23-T4: /api/me diagnostic — returns { userId, email, traderName } so
// desktop and mobile clients can confirm they're bound to the same Supabase auth user.
// Use this to debug cross-device data sync issues (if desktop and mobile return different userIds,
// they're logged into different accounts and no user-scoped data will sync).

import { Hono } from "hono";
import type { Context } from "hono";
import { getUserSettings } from "../../services/settings-store.js";

export function createMeRoutes(): Hono {
  const app = new Hono();

  app.get("/", handleGetMe);

  return app;
}

async function handleGetMe(c: Context) {
  const userId = c.get("userId") as string | undefined;
  const email = (c.get("email") as string | undefined) ?? null;

  if (!userId) {
    return c.json({ error: "Unauthorized", userId: null, email: null }, 401);
  }

  let traderName: string | null = null;
  try {
    const settings = (await getUserSettings(userId)) as Record<string, unknown>;
    traderName =
      typeof settings?.traderName === "string"
        ? (settings.traderName as string)
        : null;
  } catch {
    // fall through — traderName stays null
  }

  return c.json({ userId, email, traderName });
}
