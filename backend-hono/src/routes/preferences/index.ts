// [claude-code 2026-04-29] S51: added "Earnings" to RISKFLOW_BUCKETS for filter persistence
// [claude-code 2026-04-19] v5.22 S1: Cross-platform user preferences route. Backs the
//   shared UserPreferences contract (frontend/lib/user-preferences.ts + mobile mirror).
//   GET returns the merged prefs (defaults filled in); PUT upserts and returns the fresh row.
// [claude-code 2026-04-23] S31-T6: psychAssistEnabled flag; default false (silent mode).
// [claude-code 2026-04-25] S35-Unified: notification prefs accept manualDnd, blockedCategories,
//   severityThreshold. PUT also fans a __sync push to the user's other devices so DND/blocklist
//   changes appear in the bell on every signed-in surface within a second.
import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { getSupabaseClient } from "../../config/supabase.js";
import { isDatabaseAvailable, sql } from "../../config/database.js";
import { broadcastSyncToUser } from "../../services/notifications/sync-broadcast.js";
import { NOTIFICATION_CATEGORIES } from "../../services/notifications/emit.js";

const THEME_VALUES = [
  "solvys-gold",
  "glass-nothing",
  "light",
  "system",
] as const;

const SEVERITY_VALUES = ["low", "medium", "high", "critical"] as const;

// [claude-code 2026-04-26] S46: RiskFlow filter selections persist server-side so
// the same severity+bucket choices apply across desktop, mobile, and web for one user.
const RISKFLOW_BUCKETS = [
  "OSINT",
  "Wire",
  "Macro",
  "Commentary",
  "Econ",
  "Earnings",
  "Geopolitical",
] as const;

const riskflowFiltersSchema = z.object({
  severities: z.array(z.enum(SEVERITY_VALUES)).default([]),
  buckets: z.array(z.enum(RISKFLOW_BUCKETS)).default([]),
});

const notificationsSchema = z.object({
  rth: z.boolean(),
  extendedHours: z.boolean(),
  criticalOnly: z.boolean(),
  quietFromEtHour: z.number().min(0).max(24),
  quietToEtHour: z.number().min(0).max(24),
  manualDnd: z.boolean().default(false),
  blockedCategories: z.array(z.enum(NOTIFICATION_CATEGORIES)).default([]),
  severityThreshold: z.enum(SEVERITY_VALUES).default("medium"),
  econOnlyMode: z.boolean().default(false),
  deliveryChannels: z
    .object({
      web: z.boolean().default(true),
      push: z.boolean().default(false),
      desktop: z.boolean().default(true),
    })
    .default({ web: true, push: false, desktop: true }),
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
  riskflowFilters: riskflowFiltersSchema.optional(),
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
    manualDnd: false,
    blockedCategories: [],
    severityThreshold: "medium",
    econOnlyMode: false,
    deliveryChannels: { web: true, push: false, desktop: true },
  },
  psychAssistEnabled: false,
  riskflowFilters: { severities: [], buckets: [] },
  updatedAt: new Date(0).toISOString(),
};

const devPreferenceStore = new Map<string, Preferences>();

function dbUserId(userId: string): string {
  if (userId === "local-user") return "00000000-0000-0000-0000-000000000001";
  return userId;
}

function subscriptionCategoriesFromPrefs(
  notifications: Preferences["notifications"],
): Record<string, boolean> {
  const blocked = new Set(notifications.blockedCategories ?? []);
  return Object.fromEntries(
    NOTIFICATION_CATEGORIES.map((category) => [
      category,
      Boolean(notifications.deliveryChannels?.push) && !blocked.has(category),
    ]),
  );
}

async function syncPushSubscriptionPrefs(
  userId: string,
  notifications: Preferences["notifications"],
): Promise<void> {
  if (!isDatabaseAvailable()) return;
  await sql`
    UPDATE web_push_subscriptions
    SET categories = ${JSON.stringify(subscriptionCategoriesFromPrefs(notifications))}::jsonb,
        severity_threshold = ${notifications.severityThreshold},
        updated_at = now()
    WHERE user_id = ${userId}
  `;
}

export function createPreferencesRoutes(): Hono {
  const router = new Hono();

  // GET /api/preferences — current user's merged preferences row.
  router.get("/", async (c: Context) => {
    const rawUid = c.get("supabaseUid") as string | undefined;
    if (!rawUid) return c.json({ error: "Missing supabase uid" }, 401);
    const uid = dbUserId(rawUid);
    const devPrefs = devPreferenceStore.get(rawUid);
    if (devPrefs) return c.json(devPrefs);

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
        deliveryChannels: {
          ...DEFAULT_PREFERENCES.notifications.deliveryChannels,
          ...(stored.notifications?.deliveryChannels ?? {}),
        },
      },
      riskflowFilters: stored.riskflowFilters ?? {
        severities: [],
        buckets: [],
      },
      updatedAt: data?.updated_at ?? DEFAULT_PREFERENCES.updatedAt,
    };
    return c.json(merged);
  });

  // PUT /api/preferences — upsert the full preferences row.
  router.put("/", async (c: Context) => {
    const rawUid = c.get("supabaseUid") as string | undefined;
    if (!rawUid) return c.json({ error: "Missing supabase uid" }, 401);
    const uid = dbUserId(rawUid);

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
      if (rawUid === "local-user") {
        devPreferenceStore.set(rawUid, incoming);
        void syncPushSubscriptionPrefs(rawUid, incoming.notifications).catch(
          () => {},
        );
        return c.json(incoming);
      }
      console.error("[preferences] upsert failed:", error.message);
      return c.json({ error: "Failed to save preferences" }, 500);
    }

    void syncPushSubscriptionPrefs(uid, incoming.notifications).catch(() => {});
    if (uid !== rawUid) {
      void syncPushSubscriptionPrefs(rawUid, incoming.notifications).catch(
        () => {},
      );
    }

    // Best-effort cross-device sync — never fail the PUT on a sync hiccup.
    void broadcastSyncToUser(uid, {
      kind: "preferences",
      updatedAt: now,
    }).catch(() => {});

    return c.json(incoming);
  });

  return router;
}
