// [claude-code 2026-03-19] Cloud user sync — hydrate settings + ER from Supabase on login, debounced write-back
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const DEBOUNCE_MS = 2000;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export interface CloudSettings {
  selected_symbol?: string;
  risk_settings?: Record<string, unknown>;
  watchlist?: unknown[];
}

/**
 * Pull user settings from Supabase cloud on login
 */
export async function pullCloudSettings(userId: string): Promise<CloudSettings | null> {
  try {
    const res = await fetch(`${API_BASE}/api/cloud/settings?userId=${userId}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.settings || null;
  } catch (err) {
    console.warn('[UserSync] Failed to pull cloud settings:', err);
    return null;
  }
}

/**
 * Push user settings to Supabase cloud (debounced)
 */
export function pushCloudSettings(userId: string, settings: CloudSettings): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    try {
      await fetch(`${API_BASE}/api/cloud/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, ...settings }),
      });
    } catch (err) {
      console.warn('[UserSync] Failed to push cloud settings:', err);
    }
  }, DEBOUNCE_MS);
}

/**
 * Pull ER score history from cloud
 */
export async function pullERHistory(userId: string, limit = 20): Promise<unknown[]> {
  try {
    const res = await fetch(`${API_BASE}/api/cloud/er-sessions?userId=${userId}&limit=${limit}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.sessions || [];
  } catch {
    return [];
  }
}

/**
 * Push an ER session to cloud
 */
export async function pushERSession(data: {
  user_id: string;
  final_score?: number;
  time_in_tilt_seconds?: number;
  infraction_count?: number;
  session_duration_seconds?: number;
  is_finalized?: boolean;
}): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/cloud/er-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch {
    return false;
  }
}
