// [claude-code 2026-04-18] v5.22 shared contract — cross-platform user preferences shape.
// Backing store: Supabase user_preferences (added in T4). Desktop writes all sections; mobile writes
// only `notifications` and reads the rest. Mirror module at mobile/lib/user-preferences.ts.
// [claude-code 2026-04-23] S31-T6: psychAssistEnabled flag; default false (silent mode).
// [claude-code 2026-04-25] S35-Unified: notifications now carry manualDnd + blockedCategories
//   + severityThreshold so DND/blocklist sync across desktop + mobile via the server, not localStorage.

import type { FusePalette } from "./fuse-palette";

export type ThemeMode = "solvys-gold" | "glass-nothing" | "light" | "system";

export type Severity = "low" | "medium" | "high" | "critical";

// Server-authoritative category list. Mirrors NOTIFICATION_CATEGORIES in
// backend-hono/src/services/notifications/emit.ts; do not let it drift.
export const NOTIFICATION_CATEGORIES = [
  "riskflow",
  "dailyBrief",
  "regimeActivations",
  "regimeProposals",
  "lexiconProposals",
  "walkBackReverts",
  "toolApprovals",
  "maintenance_request",
  "chat_relay",
  "test",
  "system",
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export interface NotificationPrefs {
  rth: boolean;
  extendedHours: boolean;
  criticalOnly: boolean;
  quietFromEtHour: number;
  quietToEtHour: number;
  /** Soft DND toggle. When true, only severity >= severityThreshold pushes; everything else queues silently. */
  manualDnd: boolean;
  /** Categories the user has muted entirely. Critical-severity emissions still bypass this. */
  blockedCategories: NotificationCategory[];
  /** Lower bound for push delivery (in-app log still receives everything). */
  severityThreshold: Severity;
}

export interface UserPreferences {
  theme: ThemeMode;
  traderName?: string;
  notifications: NotificationPrefs;
  fusePalette?: Partial<FusePalette>;
  psychAssistEnabled?: boolean;
  updatedAt: string;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
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
  },
  psychAssistEnabled: false,
  updatedAt: new Date(0).toISOString(),
};

export const PREFERENCES_API_PATH = "/api/preferences" as const;
