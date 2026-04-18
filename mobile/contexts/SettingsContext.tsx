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

const API_BASE = import.meta.env.VITE_API_URL || "";

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

interface RiskSettings {
  dailyProfitTarget: number;
  dailyLossLimit: number;
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
  caoName: string;
  selectedSymbol: TradingSymbol;
  alertConfig: AlertConfig;
  riskSettings: RiskSettings;
  bulletinReminder: "once" | "until-pressed";
}

interface SettingsContextValue {
  settings: MobileSettings;
  updateSettings: (partial: Partial<MobileSettings>) => void;
  backendSynced: boolean;
  isDirty: boolean;
  isSaving: boolean;
  saveAll: () => Promise<void>;
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
  caoName: "Harper",
  selectedSymbol: { symbol: "/MNQ", contractName: "/MNQZ25" },
  alertConfig: {
    soundEnabled: true,
    vixSpikeThreshold: 22,
  },
  riskSettings: {
    dailyProfitTarget: 1500,
    dailyLossLimit: 750,
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
        riskSettings: {
          ...DEFAULT_SETTINGS.riskSettings,
          ...parsed.riskSettings,
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

// ── Context ──

const SettingsContext = createContext<SettingsContextValue | undefined>(
  undefined,
);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { getAccessToken, isAuthenticated } = useAuth();
  const [settings, setSettings] = useState<MobileSettings>(loadSettings);
  const [synced, setSynced] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const backendSyncedRef = useRef(false);
  const lastSavedRef = useRef<string>(JSON.stringify(loadSettings()));

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
            if (remote.caoName !== undefined)
              merged.caoName = remote.caoName as string;
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
            if (remote.riskSettings) {
              merged.riskSettings = {
                ...prev.riskSettings,
                ...(remote.riskSettings as RiskSettings),
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

    const currentJson = JSON.stringify(settings);
    setIsDirty(currentJson !== lastSavedRef.current);
  }, [settings]);

  const updateSettings = useCallback((partial: Partial<MobileSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const saveAll = useCallback(async () => {
    await flushSave(settings);
  }, [settings, flushSave]);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        backendSynced: synced,
        isDirty,
        isSaving,
        saveAll,
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

export type {
  MobileSettings,
  NotificationPrefs,
  AlertConfig,
  RiskSettings,
  TradingSymbol,
};
