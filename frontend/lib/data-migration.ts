// [claude-code 2026-03-24] localStorage → Supabase cloud migration engine

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const MIGRATION_FLAG = 'fintheon:migration-complete';

export interface MigrationResult {
  migrated: boolean;
  keysCount: number;
  error?: string;
}

/** localStorage keys → app_state structure mapping */
const KEY_MAP: Record<string, string> = {
  'fintheon:threads': 'threads',
  'fintheon:narrative:v1': 'narrative',
  'fintheon:narrative-snapshot:v1': 'narrativeSnapshot',
  'fintheon:regime-tracker:v2': 'regime',
  // 'fintheon:chat-checkpoints:v1' removed — checkpoint system replaced by conversation history (S9-T5)
  'fintheon:voice-transcripts:v1': 'voiceTranscripts',
  'fintheon:gateway-persistent-thread-id': 'gateway.threadId',
  'fintheon:gateway-persistent-thread-enabled': 'gateway.threadEnabled',
};

/** Layout keys — grouped under app_state.layouts */
const LAYOUT_KEYS: Record<string, string> = {
  'fintheon:sidebar-nav-order': 'sidebarNavOrder',
  'fintheon:toolbar-order': 'toolbarOrder',
  'fintheon:mission-widget-order:v4': 'missionWidgetOrder',
  'fintheon:right-panel-order': 'rightPanelOrder',
  'fintheon:mission-widget-visibility': 'missionWidgetVisibility',
};

function readLocalStorageJson(key: string): unknown | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    // Return raw string if not valid JSON
    const raw = localStorage.getItem(key);
    return raw;
  }
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current) || typeof current[parts[i]] !== 'object') {
      current[parts[i]] = {};
    }
    current = current[parts[i]] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

/**
 * Migrate all critical localStorage data to Supabase via the backend.
 * Idempotent: skips if fintheon:migration-complete is already set.
 */
export async function migrateLocalStorageToCloud(token: string): Promise<MigrationResult> {
  // Idempotency check
  if (localStorage.getItem(MIGRATION_FLAG) === 'true') {
    return { migrated: false, keysCount: 0 };
  }

  const state: Record<string, unknown> = {};
  let keysCount = 0;

  // Map top-level and nested keys
  for (const [localKey, statePath] of Object.entries(KEY_MAP)) {
    const value = readLocalStorageJson(localKey);
    if (value !== null) {
      setNestedValue(state, statePath, value);
      keysCount++;
    }
  }

  // Map layout keys → app_state.layouts.*
  const layouts: Record<string, unknown> = {};
  for (const [localKey, layoutKey] of Object.entries(LAYOUT_KEYS)) {
    const value = readLocalStorageJson(localKey);
    if (value !== null) {
      layouts[layoutKey] = value;
      keysCount++;
    }
  }
  if (Object.keys(layouts).length > 0) {
    state.layouts = layouts;
  }

  // Nothing to migrate
  if (keysCount === 0) {
    localStorage.setItem(MIGRATION_FLAG, 'true');
    return { migrated: true, keysCount: 0 };
  }

  try {
    const res = await fetch(`${API_BASE}/api/profile/app-state`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ state }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { migrated: false, keysCount, error: `HTTP ${res.status}: ${errText}` };
    }

    localStorage.setItem(MIGRATION_FLAG, 'true');
    return { migrated: true, keysCount };
  } catch (err) {
    return {
      migrated: false,
      keysCount,
      error: err instanceof Error ? err.message : 'Network error during migration',
    };
  }
}

/** Check whether migration has already run */
export function isMigrationComplete(): boolean {
  return localStorage.getItem(MIGRATION_FLAG) === 'true';
}
