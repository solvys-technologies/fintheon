// [claude-code 2026-04-19] v5.22 S1: Cross-platform user preferences route. Backs the
//   shared UserPreferences contract (frontend/lib/user-preferences.ts + mobile mirror).
//   GET returns the merged prefs (defaults filled in); PUT upserts and returns the fresh row.
// [claude-code 2026-04-23] S31-T6: psychAssistEnabled flag; default false (silent mode).
import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { getSupabaseClient } from "../../config/supabase.js";

const THEME_VALUES = [
  "solvys-gold",
  "glass-nothing",
  "light",
  "system",
] as const;

const notificationsSchema = z.object({
  rth: z.boolean(),
  extendedHours: z.boolean(),
  criticalOnly: z.boolean(),
  quietFromEtHour: z.number().min(0).max(24),
  quietToEtHour: z.number().min(0).max(24),
});

const fusePaletteOverrideSchema = z
  .object({
    severity: z.record(z.string(), z.string()).optional(),
    priority: z.record(z.string(), z.string()).optional(),
    thresholds: z
      .object({
        critical: z.number(),
        high: z.number(),
        medium: z.number(),
        low: z.number(),
      })
      .partial()
      .optional(),
  })
  .partial()
  .passthrough();

const preferencesSchema = z.object({
  theme: z.enum(THEME_VALUES),
  traderName: z.string().optional(),
  notifications: notificationsSchema,
  fusePalette: fusePaletteOverrideSchema.optional(),
  psychAssistEnabled: z.boolean().optional(),
  updatedAt: z.string(),
});

type Preferences = z.infer<typeof preferencesSchema>;

const DEFAULT_PREFERENCES: Preferences = {
  theme: "solvys-gold",
  notifications: {
    rth: true,
    extendedHours: false,
    criticalOnly: false,
    quietFromEtHour: 16,
    quietToEtHour: 9.5,
  },
  psychAssistEnabled: false,
  updatedAt: new Date(0).toISOString(),
};

export function createPreferencesRoutes(): Hono {
  const router = new Hono();

  // GET /api/preferences — current user's merged preferences row.
  router.get("/", async (c: Context) => {
    const uid = c.get("supabaseUid") as string | undefined;
    if (!uid) return c.json({ error: "Missing supabase uid" }, 401);

    const sb = getSupabaseClient();
    if (!sb) return c.json(DEFAULT_PREFERENCES);

    const { data, error } = await sb
      .from("user_preferences")
      .select("prefs, updated_at")
      .eq("user_id", uid)
      .maybeSingle();

    if (error) {
      console.error("[preferences] select failed:", error.message);
      return c.json(DEFAULT_PREFERENCES);
    }

    const stored = (data?.prefs ?? {}) as Partial<Preferences>;
    const merged: Preferences = {
      ...DEFAULT_PREFERENCES,
      ...stored,
      notifications: {
        ...DEFAULT_PREFERENCES.notifications,
        ...(stored.notifications ?? {}),
      },
      updatedAt: data?.updated_at ?? DEFAULT_PREFERENCES.updatedAt,
    };
    return c.json(merged);
  });

  // PUT /api/preferences — upsert the full preferences row.
  router.put("/", async (c: Context) => {
    const uid = c.get("supabaseUid") as string | undefined;
    if (!uid) return c.json({ error: "Missing supabase uid" }, 401);

    const raw = await c.req.json().catch(() => null);
    const parsed = preferencesSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        { error: "Invalid preferences payload", issues: parsed.error.issues },
        400,
      );
    }

    const sb = getSupabaseClient();
    if (!sb) {
      return c.json({ error: "Preferences backend not configured" }, 503);
    }

    const now = new Date().toISOString();
    const incoming: Preferences = { ...parsed.data, updatedAt: now };

    const { error } = await sb.from("user_preferences").upsert(
      {
        user_id: uid,
        prefs: incoming,
        updated_at: now,
      },
      { onConflict: "user_id" },
    );

    if (error) {
      console.error("[preferences] upsert failed:", error.message);
      return c.json({ error: "Failed to save preferences" }, 500);
    }

    return c.json(incoming);
  });

  return router;
}
