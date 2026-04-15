// [claude-code 2026-04-15] T5: UI-only filter state — client-side filtering on loaded alerts
import { useState, useMemo, useCallback } from "react";
import type { AlertSeverity } from "@frontend/lib/riskflow-feed";
import type { MobileRiskFlowAlert } from "../contexts/RiskFlowContext";

type SeverityFilter = "all" | AlertSeverity;

interface UseRiskFlowFiltersOptions {
  alerts: MobileRiskFlowAlert[];
}

export function useRiskFlowFilters({ alerts }: UseRiskFlowFiltersOptions) {
  const [activeSeverity, setActiveSeverity] = useState<SeverityFilter>("all");
  const [activeSources, setActiveSources] = useState<Set<string>>(new Set());

  const setSeverity = useCallback((level: SeverityFilter) => {
    setActiveSeverity(level);
  }, []);

  const toggleSource = useCallback((source: string) => {
    setActiveSources((prev) => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setActiveSeverity("all");
    setActiveSources(new Set());
  }, []);

  const filtered = useMemo(() => {
    let result = alerts;
    if (activeSeverity !== "all") {
      result = result.filter((a) => a.severity === activeSeverity);
    }
    if (activeSources.size > 0) {
      result = result.filter((a) => activeSources.has(a.source));
    }
    return result;
  }, [alerts, activeSeverity, activeSources]);

  return {
    filtered,
    activeSeverity,
    activeSources,
    setSeverity,
    toggleSource,
    clearFilters,
  };
}
