// [claude-code 2026-04-18] v5.22 shared contract — cross-platform user preferences shape.
// Backing store: Supabase user_preferences (added in T4). Desktop writes all sections; mobile writes
// only `notifications` and reads the rest. Mirror module at mobile/lib/user-preferences.ts.

import type { FusePalette } from "./fuse-palette";

export type ThemeMode = "solvys-gold" | "glass-nothing" | "light" | "system";

export interface NotificationPrefs {
  rth: boolean;
  extendedHours: boolean;
  criticalOnly: boolean;
  quietFromEtHour: number;
  quietToEtHour: number;
}

export interface UserPreferences {
  theme: ThemeMode;
  traderName?: string;
  notifications: NotificationPrefs;
  fusePalette?: Partial<FusePalette>;
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
  },
  updatedAt: new Date(0).toISOString(),
};

export const PREFERENCES_API_PATH = "/api/preferences" as const;
