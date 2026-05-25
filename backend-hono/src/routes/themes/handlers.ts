import type { Context } from "hono";
import * as store from "../../services/theme-tracker/persistence.js";
import * as tracker from "../../services/theme-tracker/theme-tracker.js";
import type { ThemeStatus } from "../../services/theme-tracker/types.js";
// [claude-code 2026-05-16] S68-T2: Wired drift endpoint to catalyst-drift service
import { getFeed } from "../../services/riskflow/feed-service.js";
import { calculateDrift } from "../../services/catalyst-drift/drift-calculator.js";
import type { DriftResult } from "../../services/catalyst-drift/types.js";

export async function handleListThemes(c: Context) {
  const status = c.req.query("status") as ThemeStatus | undefined;
  const themes = store.listThemes(status);
  return c.json({ themes, count: themes.length });
}

export async function handleGetTheme(c: Context) {
  const id = c.req.param("id");
  const theme = store.getTheme(id);
  if (!theme) return c.json({ error: "Theme not found" }, 404);
  return c.json(theme);
}

export async function handleCreateTheme(c: Context) {
  const body = await c.req.json().catch(() => null);
  if (!body?.name || typeof body.name !== "string") {
    return c.json({ error: "Missing required field: name" }, 400);
  }
  const catalystIds: string[] = Array.isArray(body.catalystIds)
    ? body.catalystIds
    : [];
  const initialIvp =
    typeof body.initialIvp === "number" ? body.initialIvp : 0.5;
  const theme = tracker.createTheme(body.name, catalystIds, initialIvp);
  return c.json(theme, 201);
}

export async function handleUpdateTheme(c: Context) {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "Invalid request body" }, 400);

  const allowed = ["name", "ipv", "status", "catalystIds"] as const;
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if ((body as Record<string, unknown>)[key] !== undefined)
      updates[key] = (body as Record<string, unknown>)[key];
  }
  if (Object.keys(updates).length === 0) {
    return c.json({ error: "No valid fields to update" }, 400);
  }

  const theme = store.updateTheme(id, updates);
  if (!theme) return c.json({ error: "Theme not found" }, 404);
  return c.json(theme);
}

export async function handleGetCatalysts(c: Context) {
  const id = c.req.param("id");
  const theme = store.getTheme(id);
  if (!theme) return c.json({ error: "Theme not found" }, 404);

  if (theme.catalystIds.length === 0) {
    return c.json({ catalysts: [], count: 0 });
  }

  const feedResponse = await getFeed("system", { limit: 500 });
  const catalysts = feedResponse.items.filter((item) =>
    theme.catalystIds.includes(item.id),
  );

  return c.json({ catalysts, count: catalysts.length });
}

export async function handleGetDrift(c: Context) {
  const id = c.req.param("id");
  const theme = store.getTheme(id);
  if (!theme) return c.json({ error: "Theme not found" }, 404);

  const periods = c.req.query("periods")
    ? parseInt(c.req.query("periods")!, 10)
    : undefined;

  const drift: DriftResult | null = calculateDrift(id, periods);
  if (!drift) {
    return c.json({ error: "Failed to compute drift" }, 500);
  }

  return c.json(drift);
}
