// [claude-code 2026-03-06] Regime store — localStorage persistence, CRUD, useRegimes hook
// [claude-code 2026-03-12] Migrated from W/L to bullish/bearish ORB tracking, v2 storage key
// [claude-code 2026-04-15] T2: v3 storage with fade→reversal + neutral→consolidation migration, orbHistory + antilag callbacks

import { useState, useEffect, useCallback } from "react";
import { type TradingRegime, SEED_REGIMES } from "./regimes";

const V3_STORAGE_KEY = "fintheon:regime-tracker:v3";
const V2_STORAGE_KEY = "fintheon:regime-tracker:v2";
const V1_STORAGE_KEY = "fintheon:regime-tracker:v1";

/** Migrate v1 (wins/losses) to v2 (bullishDays/bearishDays) */
function migrateV1toV2(regimes: any[]): any[] {
  return regimes.map((r) => ({
    ...r,
    record: {
      bullishDays: r.record?.bullishDays ?? r.record?.wins ?? 0,
      bearishDays: r.record?.bearishDays ?? r.record?.losses ?? 0,
    },
  }));
}

/** Migrate v2 (fade/neutral bias) to v3 (5 heuristic classifications) */
function migrateV2toV3(regimes: any[]): TradingRegime[] {
  return regimes.map((r) => ({
    ...r,
    bias:
      r.bias === "fade"
        ? "reversal"
        : r.bias === "neutral"
          ? "consolidation"
          : r.bias === "long"
            ? "continuation"
            : r.bias === "short"
              ? "reversal"
              : r.bias,
  }));
}

function loadRegimes(): TradingRegime[] {
  try {
    // Try v3 first — empty array is valid (user deleted all regimes)
    const v3Raw = localStorage.getItem(V3_STORAGE_KEY);
    if (v3Raw) {
      const parsed = JSON.parse(v3Raw);
      if (Array.isArray(parsed)) return parsed as TradingRegime[];
    }
    // Try v2 with migration
    const v2Raw = localStorage.getItem(V2_STORAGE_KEY);
    if (v2Raw) {
      const parsed = JSON.parse(v2Raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const migrated = migrateV2toV3(parsed);
        localStorage.setItem(V3_STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
    }
    // Try v1 with both migrations
    const v1Raw = localStorage.getItem(V1_STORAGE_KEY);
    if (v1Raw) {
      const parsed = JSON.parse(v1Raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const migrated = migrateV2toV3(migrateV1toV2(parsed));
        localStorage.setItem(V3_STORAGE_KEY, JSON.stringify(migrated));
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
    localStorage.setItem(V3_STORAGE_KEY, JSON.stringify(regimes));
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

  const updateRegime = useCallback(
    (id: string, updates: Partial<TradingRegime>) => {
      setRegimes((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...updates } : r)),
      );
    },
    [],
  );

  const deleteRegime = useCallback((id: string) => {
    setRegimes((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const recordBullish = useCallback((id: string) => {
    setRegimes((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              record: { ...r.record, bullishDays: r.record.bullishDays + 1 },
              daysObserved: r.daysObserved + 1,
            }
          : r,
      ),
    );
  }, []);

  const recordBearish = useCallback((id: string) => {
    setRegimes((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              record: { ...r.record, bearishDays: r.record.bearishDays + 1 },
              daysObserved: r.daysObserved + 1,
            }
          : r,
      ),
    );
  }, []);

  const updateORBHistory = useCallback(
    (
      id: string,
      entry: {
        date: string;
        openPrice: number;
        price10Min: number;
        direction: "bullish" | "bearish";
        changeBps: number;
      },
    ) => {
      setRegimes((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r;
          const history = [...(r.orbHistory ?? []), entry];
          // FIFO cap at 30
          if (history.length > 30) history.splice(0, history.length - 30);
          return { ...r, orbHistory: history };
        }),
      );
    },
    [],
  );

  const updateAntilagConfidence = useCallback((id: string, value: number) => {
    setRegimes((prev) =>
      prev.map((r) => (r.id === id ? { ...r, antilagConfidence: value } : r)),
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
    updateORBHistory,
    updateAntilagConfidence,
    resetToDefaults,
  };
}
