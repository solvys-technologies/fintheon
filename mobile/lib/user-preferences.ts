// [claude-code 2026-04-18] v5.22 shared contract — mobile mirror of frontend/lib/user-preferences.ts
// Backing store: Supabase user_preferences (added in T4). Mobile writes only `notifications`; everything
// else is read-only surface. Must mirror the frontend module byte-for-byte (minus this header).
// [claude-code 2026-04-23] S31-T6: psychAssistEnabled mirror (read-only on mobile).
// [claude-code 2026-04-25] S35-Unified: notification prefs now carry manualDnd + blockedCategories
//   + severityThreshold so settings sync across desktop + mobile via the server, not localStorage.

import type { FusePalette } from "./fuse-palette";

export type ThemeMode = "solvys-gold" | "glass-nothing" | "light" | "system";

export type Severity = "low" | "medium" | "high" | "critical";

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
  manualDnd: boolean;
  blockedCategories: NotificationCategory[];
  severityThreshold: Severity;
  /** Mute everything except econ_alerts + critical. */
  econOnlyMode: boolean;
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
    econOnlyMode: false,
  },
  psychAssistEnabled: false,
  updatedAt: new Date(0).toISOString(),
};

export const PREFERENCES_API_PATH = "/api/preferences" as const;
