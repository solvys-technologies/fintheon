// [claude-code 2026-04-15] T2: Mobile settings — notification prefs + haptic toggle, localStorage-persisted
import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

interface NotificationPrefs {
  riskflow: boolean;
  dailyBrief: boolean;
  regimeActivations: boolean;
  severityThreshold: "critical" | "high" | "medium" | "low";
}

interface MobileSettings {
  notificationPrefs: NotificationPrefs;
  hapticEnabled: boolean;
}

interface SettingsContextValue {
  settings: MobileSettings;
  updateSettings: (partial: Partial<MobileSettings>) => void;
}

const STORAGE_KEY = "fintheon-mobile:settings";

const DEFAULT_SETTINGS: MobileSettings = {
  notificationPrefs: {
    riskflow: true,
    dailyBrief: true,
    regimeActivations: true,
    severityThreshold: "medium",
  },
  hapticEnabled: true,
};

function loadSettings(): MobileSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_SETTINGS;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(
  undefined,
);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<MobileSettings>(loadSettings);

  const updateSettings = useCallback((partial: Partial<MobileSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
