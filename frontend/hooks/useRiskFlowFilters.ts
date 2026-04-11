// [claude-code 2026-04-10] S9-T2: Extracted filter state from RiskFlowMini
import { useState, useCallback } from "react";
import type { RiskFlowAlert } from "../lib/riskflow-feed";

export type SeverityFilter = "all" | "high" | "medium";
export type SourceFilter = "all" | "notion" | "twitter";

interface UseRiskFlowFiltersReturn {
  severityFilter: SeverityFilter;
  setSeverityFilter: (f: SeverityFilter) => void;
  sourceFilter: SourceFilter;
  setSourceFilter: (f: SourceFilter) => void;
  showProposals: boolean;
  setShowProposals: (v: boolean | ((prev: boolean) => boolean)) => void;
  filterAlerts: (alerts: RiskFlowAlert[]) => RiskFlowAlert[];
}

export function useRiskFlowFilters(): UseRiskFlowFiltersReturn {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [showProposals, setShowProposals] = useState(false);

  const filterAlerts = useCallback(
    (alerts: RiskFlowAlert[]): RiskFlowAlert[] => {
      let base = alerts;
      if (showProposals)
        return base.filter((a) => a.source === "notion-trade-idea");
      if (severityFilter === "high")
        base = base.filter(
          (a) => a.severity === "high" || a.severity === "critical",
        );
      else if (severityFilter === "medium")
        base = base.filter((a) => a.severity === "medium");
      if (sourceFilter === "notion")
        base = base.filter(
          (a) =>
            a.source === "notion-trade-idea" ||
            (a.source as string).toLowerCase().includes("notion"),
        );
      else if (sourceFilter === "twitter")
        base = base.filter(
          (a) =>
            (a.source as string).toLowerCase().includes("twitter") ||
            (a.source as string) === "TwitterCli" ||
            (a.source as string) === "FinancialJuice",
        );
      return base;
    },
    [severityFilter, sourceFilter, showProposals],
  );

  return {
    severityFilter,
    setSeverityFilter,
    sourceFilter,
    setSourceFilter,
    showProposals,
    setShowProposals,
    filterAlerts,
  };
}
