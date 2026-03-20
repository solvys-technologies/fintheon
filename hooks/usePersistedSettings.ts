import { useEffect, useCallback } from 'react';
import { useBackend } from '../lib/backend';

const STORAGE_KEY = 'pulse_settings';

interface PersistedSettings {
  tradingModels?: any;
  alertConfig?: any;
  mockDataEnabled?: boolean;
  selectedSymbol?: any;
  riskSettings?: any;
  developerSettings?: any;
}

export function usePersistedSettings() {
  const backend = useBackend();
  
  const loadSettings = useCallback((): PersistedSettings => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }, []);

  const saveSettings = useCallback(async (settings: PersistedSettings) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

      if (settings.riskSettings) {
        await backend.account.updateSettings({
          dailyTarget: settings.riskSettings.dailyProfitTarget,
          dailyLossLimit: settings.riskSettings.dailyLossLimit,
        });
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }, [backend]);

  return { loadSettings, saveSettings };
}
