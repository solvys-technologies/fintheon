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
  "econ_alerts",
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
  /** When true, only econ_alerts (and critical-severity) push. Convenient one-tap mute
   *  for everything except FOMC/CPI/NFP-class events without filling blockedCategories. */
  econOnlyMode: boolean;
}

// [claude-code 2026-04-26] S46: Per-user RiskFlow filter persistence so a single
// severity+bucket selection follows the user across desktop/mobile/web. Empty
// arrays = "show all" (matches the legacy localStorage default).
export const RISKFLOW_BUCKET_VALUES = [
  "Wire",
  "Macro",
  "OSINT",
  "Commentary",
  "Econ",
  "Geopolitical",
] as const;
export type RiskFlowBucket = (typeof RISKFLOW_BUCKET_VALUES)[number];

export interface RiskFlowFilterPrefs {
  severities: Severity[];
  buckets: RiskFlowBucket[];
}

export interface UserPreferences {
  theme: ThemeMode;
  traderName?: string;
  notifications: NotificationPrefs;
  fusePalette?: Partial<FusePalette>;
  psychAssistEnabled?: boolean;
  riskflowFilters?: RiskFlowFilterPrefs;
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
    econOnlyMode: false,
  },
  psychAssistEnabled: false,
  riskflowFilters: { severities: [], buckets: [] },
  updatedAt: new Date(0).toISOString(),
};

export const PREFERENCES_API_PATH = "/api/preferences" as const;
