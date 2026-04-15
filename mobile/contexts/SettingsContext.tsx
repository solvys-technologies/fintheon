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
  riskflow: boolean;
  dailyBrief: boolean;
  regimeActivations: boolean;
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
}

interface SettingsContextValue {
  settings: MobileSettings;
  updateSettings: (partial: Partial<MobileSettings>) => void;
  backendSynced: boolean;
}

// ── Defaults ──

const STORAGE_KEY = "fintheon-mobile:settings";

const DEFAULT_SETTINGS: MobileSettings = {
  notificationPrefs: {
    riskflow: true,
    dailyBrief: true,
    regimeActivations: true,
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
  const backendSyncedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Debounced save to localStorage + backend on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {}

    if (!backendSyncedRef.current || !isAuthenticated) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const token = await getAccessToken();
      await saveBackendSettings(
        settings as unknown as Record<string, unknown>,
        token,
      );
    }, 800);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [settings, isAuthenticated, getAccessToken]);

  const updateSettings = useCallback((partial: Partial<MobileSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  return (
    <SettingsContext.Provider
      value={{ settings, updateSettings, backendSynced: synced }}
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
