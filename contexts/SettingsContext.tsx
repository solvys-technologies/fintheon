// [claude-code 2026-03-19] Added cloud sync — pull settings from Supabase on mount, push on change
import { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import type { HealingBowlSound } from '../utils/healingBowlSounds';
import { pullCloudSettings, pushCloudSettings } from '../lib/user-sync';
import { useAuth } from './AuthContext';

interface APIKeys {
  openai?: string;
  tradingAPI?: string;
  newsAPI?: string;
  topstepxUsername?: string;
  topstepxApiKey?: string;
}

interface TradingModelToggles {
  momentumModel: boolean;
  meanReversionModel: boolean;
  fortyFortyClub: boolean;
  chargedUpRippers: boolean;
  morningFlush: boolean;
  lunchPowerHourFlush: boolean;
  vixFixer: boolean;
}

interface AlertConfig {
  priceAlerts: boolean;
  psychAlerts: boolean;
  newsAlerts: boolean;
  soundEnabled: boolean;
  healingBowlSound: HealingBowlSound;
}

interface RiskSettings {
  dailyProfitTarget: number;
  dailyLossLimit: number;
  maxTrades?: number;
  overTradingDuration?: number;
}

interface TradingSymbol {
  symbol: string;
  contractName: string;
}

interface DeveloperSettings {
  showTestTradeButton: boolean;
}

interface SettingsContextType {
  apiKeys: APIKeys;
  setAPIKeys: (keys: APIKeys) => void;
  tradingModels: TradingModelToggles;
  setTradingModels: (models: TradingModelToggles) => void;
  alertConfig: AlertConfig;
  setAlertConfig: (config: AlertConfig) => void;
  mockDataEnabled: boolean;
  setMockDataEnabled: (enabled: boolean) => void;
  selectedSymbol: TradingSymbol;
  setSelectedSymbol: (symbol: TradingSymbol) => void;
  riskSettings: RiskSettings;
  setRiskSettings: (settings: RiskSettings) => void;
  developerSettings: DeveloperSettings;
  setDeveloperSettings: (settings: DeveloperSettings) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const STORAGE_KEY = 'pulse_settings';

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed[key] !== undefined ? parsed[key] : defaultValue;
    }
  } catch {}
  return defaultValue;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  // Cloud sync: pull from Supabase on mount, push on change
  const { userId, isAuthenticated } = useAuth();
  const cloudSyncRef = useRef(false);

  const [apiKeys, setAPIKeys] = useState<APIKeys>(() =>
    loadFromStorage('apiKeys', {})
  );
  const [tradingModels, setTradingModels] = useState<TradingModelToggles>(() => 
    loadFromStorage('tradingModels', {
      momentumModel: true,
      meanReversionModel: false,
      fortyFortyClub: true,
      chargedUpRippers: true,
      morningFlush: true,
      lunchPowerHourFlush: true,
      vixFixer: true,
    })
  );
  const [alertConfig, setAlertConfig] = useState<AlertConfig>(() =>
    loadFromStorage('alertConfig', {
      priceAlerts: true,
      psychAlerts: true,
      newsAlerts: false,
      soundEnabled: true,
      healingBowlSound: 'calm-1' as HealingBowlSound,
    })
  );
  const [mockDataEnabled, setMockDataEnabled] = useState(() => 
    loadFromStorage('mockDataEnabled', true)
  );
  const [selectedSymbol, setSelectedSymbol] = useState<TradingSymbol>(() => 
    loadFromStorage('selectedSymbol', {
      symbol: '/MNQ',
      contractName: '/MNQZ25',
    })
  );
  const [riskSettings, setRiskSettings] = useState<RiskSettings>(() => 
    loadFromStorage('riskSettings', {
      dailyProfitTarget: 1500,
      dailyLossLimit: 750,
      maxTrades: 5,
      overTradingDuration: 15,
    })
  );
  const [developerSettings, setDeveloperSettings] = useState<DeveloperSettings>(() => 
    loadFromStorage('developerSettings', {
      showTestTradeButton: false,
    })
  );

  useEffect(() => {
    try {
      const settings = {
        apiKeys,
        tradingModels,
        alertConfig,
        mockDataEnabled,
        selectedSymbol,
        riskSettings,
        developerSettings,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to persist settings:', error);
    }
  }, [apiKeys, tradingModels, alertConfig, mockDataEnabled, selectedSymbol, riskSettings, developerSettings]);

  // Cloud sync: pull settings from Supabase on login
  useEffect(() => {
    if (!isAuthenticated || !userId || cloudSyncRef.current) return;
    cloudSyncRef.current = true;

    pullCloudSettings(userId).then((cloud) => {
      if (!cloud) return;
      // Merge cloud settings (cloud wins for symbol + risk settings)
      if (cloud.selected_symbol) {
        try {
          const parsed = typeof cloud.selected_symbol === 'string'
            ? JSON.parse(cloud.selected_symbol)
            : cloud.selected_symbol;
          if (parsed?.symbol) setSelectedSymbol(parsed);
        } catch { /* keep local */ }
      }
      if (cloud.risk_settings && typeof cloud.risk_settings === 'object') {
        setRiskSettings((prev) => ({ ...prev, ...cloud.risk_settings }));
      }
    });
  }, [isAuthenticated, userId]);

  // Cloud sync: push settings on change (debounced, after initial load)
  useEffect(() => {
    if (!isAuthenticated || !userId || !cloudSyncRef.current) return;
    pushCloudSettings(userId, {
      selected_symbol: JSON.stringify(selectedSymbol),
      risk_settings: riskSettings as Record<string, unknown>,
    });
  }, [selectedSymbol, riskSettings, isAuthenticated, userId]);

  return (
    <SettingsContext.Provider
      value={{
        apiKeys,
        setAPIKeys,
        tradingModels,
        setTradingModels,
        alertConfig,
        setAlertConfig,
        mockDataEnabled,
        setMockDataEnabled,
        selectedSymbol,
        setSelectedSymbol,
        riskSettings,
        setRiskSettings,
        developerSettings,
        setDeveloperSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
