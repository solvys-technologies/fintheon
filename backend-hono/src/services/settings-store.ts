// [claude-code 2026-03-10] User settings persistence — PostgreSQL with in-memory fallback
import { sql, isDatabaseAvailable } from "../config/database.js";

export interface UserSettings {
  theme?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  trading?: Record<string, unknown>;
  notifications?: Record<string, unknown>;
  appearance?: Record<string, unknown>;
  developer?: Record<string, unknown>;
  [key: string]: unknown;
}

// In-memory fallback for dev / no-database mode
const memorySettings = new Map<string, UserSettings>();

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function mergeSettings(
  current: UserSettings,
  patch: UserSettings,
): UserSettings {
  const next: UserSettings = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    const existing = next[key];
    next[key] =
      isPlainObject(existing) && isPlainObject(value)
        ? mergeSettings(existing, value)
        : value;
  }
  return next;
}

/**
 * Get user settings
 */
export async function getUserSettings(userId: string): Promise<UserSettings> {
  if (!isDatabaseAvailable() || !sql) {
    return memorySettings.get(userId) ?? {};
  }

  try {
    const result = await sql`
      SELECT settings FROM user_settings WHERE user_id = ${userId} LIMIT 1
    `;
    if (result.length === 0) return {};
    return (result[0] as { settings: UserSettings }).settings ?? {};
  } catch (err: unknown) {
    // Table may not exist yet — graceful fallback
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("does not exist") || msg.includes('column "settings"')) {
      console.warn(
        "[SettingsStore] user_settings settings column unavailable, using memory fallback",
      );
      return memorySettings.get(userId) ?? {};
    }
    throw err;
  }
}

/**
 * Save user settings (upsert)
 */
export async function saveUserSettings(
  userId: string,
  settings: UserSettings,
): Promise<UserSettings> {
  if (!isDatabaseAvailable() || !sql) {
    const merged = mergeSettings(memorySettings.get(userId) ?? {}, settings);
    memorySettings.set(userId, merged);
    return merged;
  }

  try {
    const current = await getUserSettings(userId);
    const merged = mergeSettings(current, settings);
    const jsonStr = JSON.stringify(merged);
    await sql`
      INSERT INTO user_settings (user_id, settings, updated_at)
      VALUES (${userId}, ${jsonStr}::jsonb, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET settings = ${jsonStr}::jsonb, updated_at = NOW()
    `;
    return merged;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("does not exist") || msg.includes('column "settings"')) {
      console.log("[SettingsStore] Ensuring user_settings settings column...");
      await sql`
        CREATE TABLE IF NOT EXISTS user_settings (
          user_id TEXT PRIMARY KEY,
          settings JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      await sql`
        ALTER TABLE user_settings
        ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb
      `;
      // Retry the upsert
      const jsonStr = JSON.stringify(settings);
      await sql`
        INSERT INTO user_settings (user_id, settings, updated_at)
        VALUES (${userId}, ${jsonStr}::jsonb, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET settings = ${jsonStr}::jsonb, updated_at = NOW()
      `;
      return settings;
    }
    throw err;
  }
}
