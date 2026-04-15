// [claude-code 2026-04-15] T4: Regime tracker hook — wraps shared regime utilities with 15s tick
import { useState, useEffect, useMemo } from "react";
import { useRegimes } from "@frontend/lib/regime-store";
import {
  isRegimeActive,
  getTimeRemaining,
  getUpcomingRegimes,
  formatTime12H,
} from "@frontend/lib/regime-time";
import type { TradingRegime } from "@frontend/lib/regimes";

interface RegimeTrackerState {
  activeRegimes: TradingRegime[];
  upcomingRegimes: TradingRegime[];
  timeRemaining: Record<string, string>;
}

export function useRegimeTracker(): RegimeTrackerState {
  const { regimes } = useRegimes();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  return useMemo(() => {
    const active = regimes.filter((r) => isRegimeActive(r));
    const upcoming = getUpcomingRegimes(regimes, 120);
    const remaining: Record<string, string> = {};
    for (const r of [...active, ...upcoming]) {
      remaining[r.id] = getTimeRemaining(r);
    }
    return {
      activeRegimes: active,
      upcomingRegimes: upcoming,
      timeRemaining: remaining,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regimes, tick]);
}

export { formatTime12H };
