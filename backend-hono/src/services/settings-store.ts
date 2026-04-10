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
    if (msg.includes("does not exist")) {
      console.warn(
        "[SettingsStore] user_settings table not found, using memory fallback",
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
    memorySettings.set(userId, settings);
    return settings;
  }

  try {
    const jsonStr = JSON.stringify(settings);
    await sql`
      INSERT INTO user_settings (user_id, settings, updated_at)
      VALUES (${userId}, ${jsonStr}::jsonb, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET settings = ${jsonStr}::jsonb, updated_at = NOW()
    `;
    return settings;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("does not exist")) {
      // Auto-create table
      console.log("[SettingsStore] Creating user_settings table...");
      await sql`
        CREATE TABLE IF NOT EXISTS user_settings (
          user_id TEXT PRIMARY KEY,
          settings JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
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
