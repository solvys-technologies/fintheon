// [claude-code 2026-04-23] S31-T9 predictive knowledge graph + feature proposals
// Telemetry intake (POST batch) + intent read (GET ranked surfaces over a window).
// Auth: Supabase JWT required (mounted under authMiddleware + requireAuth).
// Payload is opaque — surface + action + targetId + metadata only; no prices, no order IDs.

import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { getSupabaseClient } from "../config/supabase.js";

const eventSchema = z.object({
  surface: z.string().min(1).max(64),
  action: z.string().min(1).max(64),
  targetId: z.string().max(128).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const batchSchema = z.array(eventSchema).min(1).max(100);

const MAX_WINDOW_DAYS = 90;

export function createUsageEventsRoutes(): Hono {
  const router = new Hono();

  // POST /api/usage-events — batch insert. Fire-and-forget; returns count.
  router.post("/", async (c: Context) => {
    const uid = c.get("supabaseUid") as string | undefined;
    if (!uid) return c.json({ error: "Missing supabase uid" }, 401);

    const raw = await c.req.json().catch(() => null);
    const parsed = batchSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        { error: "Invalid usage event batch", issues: parsed.error.issues },
        400,
      );
    }

    const sb = getSupabaseClient();
    if (!sb) return c.json({ inserted: 0, degraded: true });

    const rows = parsed.data.map((e) => ({
      user_id: uid,
      surface: e.surface,
      action: e.action,
      target_id: e.targetId ?? null,
      metadata: e.metadata ?? null,
    }));

    const { error } = await sb.from("usage_events").insert(rows);
    if (error) {
      console.error("[usage-events] insert failed:", error.message);
      return c.json({ error: "Failed to record events" }, 500);
    }

    return c.json({ inserted: rows.length });
  });

  // GET /api/usage-events/intent?days=30 — ranked surfaces + trend direction.
  router.get("/intent", async (c: Context) => {
    const uid = c.get("supabaseUid") as string | undefined;
    if (!uid) return c.json({ error: "Missing supabase uid" }, 401);

    const daysParam = Number(c.req.query("days") ?? 30);
    const windowDays = Math.min(
      Math.max(Number.isFinite(daysParam) ? daysParam : 30, 1),
      MAX_WINDOW_DAYS,
    );

    const sb = getSupabaseClient();
    if (!sb) {
      return c.json({ windowDays, surfaces: [], totalEvents: 0 });
    }

    const halfWindow = Math.max(1, Math.floor(windowDays / 2));
    const sinceFull = new Date(
      Date.now() - windowDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    const sinceRecent = new Date(
      Date.now() - halfWindow * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data, error } = await sb
      .from("usage_events")
      .select("surface, action, ts")
      .eq("user_id", uid)
      .gte("ts", sinceFull)
      .limit(20000);

    if (error) {
      console.error("[usage-events] intent select failed:", error.message);
      return c.json({ windowDays, surfaces: [], totalEvents: 0 });
    }

    type Row = { surface: string; action: string; ts: string };
    const events = (data ?? []) as Row[];
    const totalEvents = events.length;

    const buckets = new Map<
      string,
      { recent: number; older: number; actions: Set<string> }
    >();
    for (const ev of events) {
      const bucket = buckets.get(ev.surface) ?? {
        recent: 0,
        older: 0,
        actions: new Set<string>(),
      };
      if (ev.ts >= sinceRecent) bucket.recent += 1;
      else bucket.older += 1;
      bucket.actions.add(ev.action);
      buckets.set(ev.surface, bucket);
    }

    const surfaces = Array.from(buckets.entries())
      .map(([surface, b]) => {
        const events = b.recent + b.older;
        const trendDelta = b.recent - b.older;
        const trend: "up" | "down" | "flat" =
          trendDelta > Math.max(2, b.older * 0.25)
            ? "up"
            : trendDelta < -Math.max(2, b.older * 0.25)
              ? "down"
              : "flat";
        return {
          surface,
          events,
          distinctActions: b.actions.size,
          trend,
          trendDelta,
        };
      })
      .sort((a, b) => b.events - a.events);

    return c.json({ windowDays, surfaces, totalEvents });
  });

  return router;
}
