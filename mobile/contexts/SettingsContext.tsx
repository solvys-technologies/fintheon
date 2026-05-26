// [claude-code 2026-05-15] S66: selectedInstrument state for mobile instrument selector, mirroring desktop TradingTab.
// [claude-code 2026-04-18] v5.22 S2: cross-platform settings sync. Adds a parallel
//   /api/preferences fetch + 30s poll for the shared UserPreferences contract (theme,
//   delivery-window notifications, traderName, fusePalette overrides). The existing
//   /api/settings flow (mobile-specific category toggles + alertConfig + selectedSymbol)
//   stays intact — the two endpoints carry different concerns. Theme bridges through
//   ThemeContext both ways: mobile theme change → PUT /api/preferences; remote theme
//   change from poll → ThemeContext.setTheme. If S1 hasn't deployed /api/preferences yet,
//   the fetch silently no-ops (404) and the app falls back to local defaults.
// [claude-code 2026-04-19] S26-P1 T6: removed caoName + riskSettings per TP — mobile
//   trader section is identity-only now. Desktop stays authoritative for both fields.
// [claude-code 2026-04-19] TP beta polish: drop the 800ms auto-save debounce. Changes
//   now stage locally (still written to localStorage for reload persistence), and only
//   commit to the backend when the user presses the save control in Settings UI.
// [claude-code 2026-04-19] S24 unify: per TP — only regimeProposals + walkBackReverts default ON; everything else opt-in. Keeps the lock screen quiet except for the two categories that require immediate decisions.
// [claude-code 2026-04-19] S24-T1: add regimeProposals / lexiconProposals / walkBackReverts notification categories; default-on so TP's phone gets V4 approvals + walk-back reverts out of the box.
// [claude-code 2026-04-15] S19: Mobile settings — expanded with backend sync, trader prefs, risk display
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import { setHapticsEnabled } from "../lib/haptics";
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_API_PATH,
  type UserPreferences,
  type ThemeMode,
} from "../lib/user-preferences";

const API_BASE = import.meta.env.VITE_API_URL || "";
const PREFERENCES_POLL_MS = 30_000;

// ── Types ──

interface NotificationPrefs {
  /** User intent to keep push enabled across sessions. UI reconciles with live subscription state. */
  pushEnabled: boolean;
  riskflow: boolean;
  dailyBrief: boolean;
  regimeActivations: boolean;
  /** [S24-T1] Agent proposals awaiting TP approval. Default ON. */
  regimeProposals: boolean;
  /** [S24-T1] Agent-proposed lexicon keywords awaiting TP approval. Default ON. */
  lexiconProposals: boolean;
  /** [S24-T1] Walk-back reverts (e.g. ceasefire collapsed 4h after confirmation). Default ON. */
  walkBackReverts: boolean;
  toolApprovals: boolean;
  severityThreshold: "critical" | "high" | "medium" | "low";
}

interface AlertConfig {
  soundEnabled: boolean;
  vixSpikeThreshold: number;
}

interface TradingSymbol {
  symbol: string;
  contractName: string;
}

interface MobileSettings {
  notificationPrefs: NotificationPrefs;
  hapticEnabled: boolean;
  traderName: string;
  hermesEnabled: boolean;
  selectedSymbol: TradingSymbol;
  selectedInstrument: string;
  alertConfig: AlertConfig;
  bulletinReminder: "once" | "until-pressed";
}

interface SettingsContextValue {
  settings: MobileSettings;
  updateSettings: (partial: Partial<MobileSettings>) => void;
  backendSynced: boolean;
  isDirty: boolean;
  isSaving: boolean;
  saveAll: () => Promise<void>;
  /** [v5.22 S2] Cross-platform UserPreferences mirror. Theme + notifications + traderName
   *  + fusePalette overrides. Read from /api/preferences, polled every 30s. Mobile writes
   *  notifications + theme (per TP — "all personalization should work like this"). */
  preferences: UserPreferences;
  /** Optimistically applies the patch locally + PUTs /api/preferences. Silent on failure
   *  so the UI stays responsive even when S1 backend is unavailable. */
  setPreferences: (partial: Partial<UserPreferences>) => Promise<void>;
}

// ── Defaults ──

const STORAGE_KEY = "fintheon-mobile:settings";

const DEFAULT_SETTINGS: MobileSettings = {
  notificationPrefs: {
    pushEnabled: false,
    // S24 unify: only the two decision-critical categories default ON.
    // The rest stay opt-in so the lock screen isn't noisy. Toggle in Settings.
    riskflow: false,
    dailyBrief: false,
    regimeActivations: false,
    regimeProposals: true,
    lexiconProposals: false,
    walkBackReverts: true,
    toolApprovals: false,
    severityThreshold: "medium",
  },
  hapticEnabled: true,
  traderName: "",
  hermesEnabled: true,
  selectedSymbol: { symbol: "/MNQ", contractName: "/MNQZ25" },
  selectedInstrument: "/NQ",
  alertConfig: {
    soundEnabled: true,
    vixSpikeThreshold: 22,
  },
  bulletinReminder: "until-pressed" as const,
};

// ── Storage helpers ──

function loadSettings(): MobileSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        notificationPrefs: {
          ...DEFAULT_SETTINGS.notificationPrefs,
          ...parsed.notificationPrefs,
        },
        alertConfig: {
          ...DEFAULT_SETTINGS.alertConfig,
          ...parsed.alertConfig,
        },
        selectedSymbol: {
          ...DEFAULT_SETTINGS.selectedSymbol,
          ...parsed.selectedSymbol,
        },
      };
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

// ── Backend sync ──

async function fetchBackendSettings(
  token: string | null,
): Promise<Record<string, unknown> | null> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/api/settings`, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.settings ?? null;
  } catch {
    return null;
  }
}

async function saveBackendSettings(
  settings: Record<string, unknown>,
  token: string | null,
): Promise<void> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    await fetch(`${API_BASE}/api/settings`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ settings }),
    });
  } catch {}
}

// ── /api/preferences shared contract (v5.22 S2) ──

async function fetchBackendPreferences(
  token: string | null,
): Promise<UserPreferences | null> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${PREFERENCES_API_PATH}`, { headers });
    if (!res.ok) return null;
    const data = (await res.json()) as
      | UserPreferences
      | { preferences?: UserPreferences };
    if ("preferences" in data) return data.preferences ?? null;
    return data as UserPreferences;
  } catch {
    return null;
  }
}

async function saveBackendPreferences(
  preferences: UserPreferences,
  token: string | null,
): Promise<void> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    await fetch(`${API_BASE}${PREFERENCES_API_PATH}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(preferences),
    });
  } catch {}
}

// ── Context ──

const SettingsContext = createContext<SettingsContextValue | undefined>(
  undefined,
);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { getAccessToken, isAuthenticated } = useAuth();
  const { theme, setTheme, availableThemes } = useTheme();
  const [settings, setSettings] = useState<MobileSettings>(loadSettings);
  const [synced, setSynced] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [preferences, setPreferencesState] =
    useState<UserPreferences>(DEFAULT_PREFERENCES);
  const backendSyncedRef = useRef(false);
  const lastSavedRef = useRef<string>(JSON.stringify(loadSettings()));
  /** Tracks whether the most recent local preferences came from a remote sync.
   *  Prevents the theme-bridge effect from echoing remote-driven theme changes
   *  back to the server. */
  const lastRemoteThemeRef = useRef<ThemeMode | null>(null);

  // On mount: localStorage first (instant paint), then backend fetch (backend wins)
  useEffect(() => {
    if (!isAuthenticated) {
      backendSyncedRef.current = true;
      setSynced(true);
      return;
    }

    (async () => {
      try {
        const token = await getAccessToken();
        const remote = await fetchBackendSettings(token);
        if (remote && typeof remote === "object") {
          setSettings((prev) => {
            const merged = { ...prev };
            if (remote.traderName !== undefined)
              merged.traderName = remote.traderName as string;
            if (remote.hermesEnabled !== undefined)
              merged.hermesEnabled = remote.hermesEnabled as boolean;
            if (remote.selectedSymbol)
              merged.selectedSymbol = {
                ...prev.selectedSymbol,
                ...(remote.selectedSymbol as TradingSymbol),
              };
            if (remote.alertConfig) {
              const remoteAlert = remote.alertConfig as Record<string, unknown>;
              merged.alertConfig = {
                ...prev.alertConfig,
                soundEnabled:
                  (remoteAlert.soundEnabled as boolean) ??
                  prev.alertConfig.soundEnabled,
                vixSpikeThreshold:
                  (remoteAlert.vixSpikeThreshold as number) ??
                  prev.alertConfig.vixSpikeThreshold,
              };
            }
            return merged;
          });
        }
      } catch {}
      backendSyncedRef.current = true;
      setSynced(true);
    })();
  }, [isAuthenticated, getAccessToken]);

  // Flush save — immediate, used by saveAll and debounce
  const flushSave = useCallback(
    async (current: MobileSettings) => {
      setIsSaving(true);
      try {
        const token = await getAccessToken();
        await saveBackendSettings(
          current as unknown as Record<string, unknown>,
          token,
        );
        // Sync display name to profile
        if (current.traderName) {
          await fetch(`${API_BASE}/api/profile`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ display_name: current.traderName }),
          }).catch(() => {});
        }
        lastSavedRef.current = JSON.stringify(current);
        setIsDirty(false);
      } finally {
        setIsSaving(false);
      }
    },
    [getAccessToken],
  );

  // Stage changes locally. Backend commit is manual via saveAll() (tap the Save
  // button in Settings). LocalStorage is still written every change so the UI
  // stays consistent across reloads while the user is drafting.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {}

    // Keep the module-level haptics flag in sync with the setting so non-React
    // call-sites (toasts, service handlers) respect user intent immediately.
    setHapticsEnabled(settings.hapticEnabled);

    const currentJson = JSON.stringify(settings);
    setIsDirty(currentJson !== lastSavedRef.current);
  }, [settings]);

  const updateSettings = useCallback((partial: Partial<MobileSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const saveAll = useCallback(async () => {
    await flushSave(settings);
  }, [settings, flushSave]);

  // ── /api/preferences sync ──

  const setPreferences = useCallback(
    async (partial: Partial<UserPreferences>) => {
      let next: UserPreferences = preferences;
      setPreferencesState((prev) => {
        next = {
          ...prev,
          ...partial,
          notifications: {
            ...prev.notifications,
            ...(partial.notifications ?? {}),
            deliveryChannels: {
              ...prev.notifications.deliveryChannels,
              ...(partial.notifications?.deliveryChannels ?? {}),
            },
          },
          updatedAt: new Date().toISOString(),
        };
        return next;
      });
      if (!isAuthenticated) return;
      try {
        const token = await getAccessToken();
        await saveBackendPreferences(next, token);
      } catch {
        // best effort — local state already reflects the change
      }
    },
    [preferences, isAuthenticated, getAccessToken],
  );

  // Mount: fetch /api/preferences once. Silent on 404 (S1 may not have shipped yet).
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      const token = await getAccessToken();
      const remote = await fetchBackendPreferences(token);
      if (cancelled || !remote) return;
      setPreferencesState((prev) =>
        new Date(remote.updatedAt) > new Date(prev.updatedAt) ? remote : prev,
      );
      if (remote.traderName) {
        setSettings((prev) => ({
          ...prev,
          traderName: remote.traderName ?? "",
        }));
      }
      lastRemoteThemeRef.current = remote.theme;
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, getAccessToken]);

  // 30s poll for cross-device updates. Replaces local state when remote.updatedAt is
  // newer; theme-bridge effect picks up the change and applies it through ThemeContext.
  useEffect(() => {
    if (!isAuthenticated) return;
    const id = setInterval(async () => {
      const token = await getAccessToken();
      const remote = await fetchBackendPreferences(token);
      if (!remote) return;
      setPreferencesState((prev) =>
        new Date(remote.updatedAt) > new Date(prev.updatedAt) ? remote : prev,
      );
      if (remote.traderName) {
        setSettings((prev) =>
          prev.traderName === remote.traderName
            ? prev
            : { ...prev, traderName: remote.traderName ?? "" },
        );
      }
    }, PREFERENCES_POLL_MS);
    return () => clearInterval(id);
  }, [isAuthenticated, getAccessToken]);

  // Bridge: ThemeContext.theme → preferences.theme. Sends the local theme name
  // to /api/preferences whenever the user picks a new theme on this device. The
  // ref guard skips echoes from a remote-driven theme apply.
  useEffect(() => {
    const localMode = theme.name as ThemeMode;
    if (preferences.theme === localMode) return;
    if (lastRemoteThemeRef.current === localMode) {
      lastRemoteThemeRef.current = null;
      return;
    }
    void setPreferences({ theme: localMode });
  }, [theme.name, preferences.theme, setPreferences]);

  // Bridge: preferences.theme → ThemeContext.setTheme. When the poll detects that
  // another device flipped the theme, look up the matching preset and apply it.
  // Falls back silently when the remote name doesn't map to a known preset.
  useEffect(() => {
    if (preferences.theme === (theme.name as ThemeMode)) return;
    const next = availableThemes[preferences.theme];
    if (!next) return;
    lastRemoteThemeRef.current = preferences.theme;
    setTheme(next);
  }, [preferences.theme, theme.name, availableThemes, setTheme]);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        backendSynced: synced,
        isDirty,
        isSaving,
        saveAll,
        preferences,
        setPreferences,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}

export type { MobileSettings, NotificationPrefs, AlertConfig, TradingSymbol };
