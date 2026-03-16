// [claude-code 2026-03-06] Regime store — localStorage persistence, CRUD, useRegimes hook
// [claude-code 2026-03-12] Migrated from W/L to bullish/bearish ORB tracking, v2 storage key

import { useState, useEffect, useCallback } from 'react';
import { type TradingRegime, SEED_REGIMES } from './regimes';

const STORAGE_KEY = 'fintheon:regime-tracker:v2';
const OLD_STORAGE_KEY = 'fintheon:regime-tracker:v1';

/** Migrate v1 (wins/losses) to v2 (bullishDays/bearishDays) */
function migrateV1toV2(regimes: any[]): TradingRegime[] {
  return regimes.map((r) => ({
    ...r,
    record: {
      bullishDays: r.record?.bullishDays ?? r.record?.wins ?? 0,
      bearishDays: r.record?.bearishDays ?? r.record?.losses ?? 0,
    },
  }));
}

function loadRegimes(): TradingRegime[] {
  try {
    // Try v2 first
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as TradingRegime[];
    }
    // Migrate from v1
    const oldRaw = localStorage.getItem(OLD_STORAGE_KEY);
    if (oldRaw) {
      const parsed = JSON.parse(oldRaw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const migrated = migrateV1toV2(parsed);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
    }
    return [...SEED_REGIMES];
  } catch {
    return [...SEED_REGIMES];
  }
}

function saveRegimes(regimes: TradingRegime[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(regimes));
  } catch {
    // ignore
  }
}

export function useRegimes() {
  const [regimes, setRegimes] = useState<TradingRegime[]>(loadRegimes);

  // Persist on change
  useEffect(() => {
    saveRegimes(regimes);
  }, [regimes]);

  const addRegime = useCallback((regime: TradingRegime) => {
    setRegimes((prev) => [...prev, regime]);
  }, []);

  const updateRegime = useCallback((id: string, updates: Partial<TradingRegime>) => {
    setRegimes((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    );
  }, []);

  const deleteRegime = useCallback((id: string) => {
    setRegimes((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const recordBullish = useCallback((id: string) => {
    setRegimes((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, record: { ...r.record, bullishDays: r.record.bullishDays + 1 }, daysObserved: r.daysObserved + 1 }
          : r,
      ),
    );
  }, []);

  const recordBearish = useCallback((id: string) => {
    setRegimes((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, record: { ...r.record, bearishDays: r.record.bearishDays + 1 }, daysObserved: r.daysObserved + 1 }
          : r,
      ),
    );
  }, []);

  const resetToDefaults = useCallback(() => {
    setRegimes([...SEED_REGIMES]);
  }, []);

  return {
    regimes,
    addRegime,
    updateRegime,
    deleteRegime,
    recordBullish,
    recordBearish,
    resetToDefaults,
  };
}
