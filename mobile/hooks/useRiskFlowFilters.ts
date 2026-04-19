// [claude-code 2026-04-15] T5: UI-only filter state — client-side filtering on loaded alerts
// [claude-code 2026-04-19] Polish pass: severity filter is now multi-select (Set). Empty
//   set = "All". Selection persists to localStorage so app restart / PWA reopen keeps the
//   user's filter choice. Mirrors the desktop multi-select model.
import { useState, useMemo, useCallback, useEffect } from "react";
import type { AlertSeverity } from "@frontend/lib/riskflow-feed";
import type { MobileRiskFlowAlert } from "../contexts/RiskFlowContext";

interface UseRiskFlowFiltersOptions {
  alerts: MobileRiskFlowAlert[];
}

const STORAGE_KEY = "fintheon-mobile:riskflow-filters:v1";
const VALID_SEVERITIES: ReadonlySet<AlertSeverity> = new Set([
  "critical",
  "high",
  "medium",
  "low",
]);

interface PersistedState {
  severities: AlertSeverity[];
  sources: string[];
}

function loadPersisted(): PersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const severities = Array.isArray(parsed.severities)
      ? parsed.severities.filter((s): s is AlertSeverity =>
          VALID_SEVERITIES.has(s as AlertSeverity),
        )
      : [];
    const sources = Array.isArray(parsed.sources)
      ? parsed.sources.filter((s): s is string => typeof s === "string")
      : [];
    return { severities, sources };
  } catch {
    return null;
  }
}

function savePersisted(state: PersistedState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function useRiskFlowFilters({ alerts }: UseRiskFlowFiltersOptions) {
  const [activeSeverities, setActiveSeverities] = useState<Set<AlertSeverity>>(
    () => {
      const persisted = loadPersisted();
      return new Set(persisted?.severities ?? []);
    },
  );
  const [activeSources, setActiveSources] = useState<Set<string>>(() => {
    const persisted = loadPersisted();
    return new Set(persisted?.sources ?? []);
  });

  useEffect(() => {
    savePersisted({
      severities: Array.from(activeSeverities),
      sources: Array.from(activeSources),
    });
  }, [activeSeverities, activeSources]);

  const toggleSeverity = useCallback((level: AlertSeverity) => {
    setActiveSeverities((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  }, []);

  const clearSeverities = useCallback(() => setActiveSeverities(new Set()), []);

  const toggleSource = useCallback((source: string) => {
    setActiveSources((prev) => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setActiveSeverities(new Set());
    setActiveSources(new Set());
  }, []);

  const filtered = useMemo(() => {
    let result = alerts;
    if (activeSeverities.size > 0) {
      result = result.filter((a) => activeSeverities.has(a.severity));
    }
    if (activeSources.size > 0) {
      result = result.filter((a) => activeSources.has(a.source));
    }
    return result;
  }, [alerts, activeSeverities, activeSources]);

  return {
    filtered,
    activeSeverities,
    activeSources,
    toggleSeverity,
    clearSeverities,
    toggleSource,
    clearFilters,
  };
}
