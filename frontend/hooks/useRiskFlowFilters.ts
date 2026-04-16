// [claude-code 2026-04-10] S9-T2: Extracted filter state from RiskFlowMini
// [claude-code 2026-04-15] S16-T5: Expanded source filters for all pipeline sources
import { useState, useCallback } from "react";
import type { RiskFlowAlert } from "../lib/riskflow-feed";

export type SeverityFilter = "all" | "high" | "medium";
export type SourceFilter =
  | "all"
  | "twitter"
  | "financial-juice"
  | "deitaone"
  | "osint"
  | "econ-calendar"
  | "polymarket-kalshi"
  | "hermes";

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
      if (showProposals) return base.filter((a) => a.source === "trade-idea");
      if (severityFilter === "high")
        base = base.filter(
          (a) => a.severity === "high" || a.severity === "critical",
        );
      else if (severityFilter === "medium")
        base = base.filter((a) => a.severity === "medium");
      if (sourceFilter === "twitter")
        base = base.filter(
          (a) =>
            (a.source as string) === "TwitterCli" ||
            (a.source as string) === "rettiwt" ||
            (a.source as string) === "Rettiwt",
        );
      else if (sourceFilter === "financial-juice")
        base = base.filter(
          (a) =>
            (a.source as string) === "FinancialJuice" ||
            (a.source as string) === "financial-juice",
        );
      else if (sourceFilter === "deitaone")
        base = base.filter((a) => (a.source as string) === "DeItaOne");
      else if (sourceFilter === "osint")
        base = base.filter(
          (a) =>
            (a.source as string) === "OSINTSources" ||
            (a.source as string) === "osint-sources",
        );
      else if (sourceFilter === "econ-calendar")
        base = base.filter(
          (a) =>
            (a.source as string) === "EconomicCalendar" ||
            (a.source as string) === "economic-calendar",
        );
      else if (sourceFilter === "polymarket-kalshi")
        base = base.filter(
          (a) =>
            (a.source as string) === "Polymarket" ||
            (a.source as string) === "polymarket" ||
            (a.source as string) === "Kalshi" ||
            (a.source as string) === "kalshi-whale",
        );
      else if (sourceFilter === "hermes")
        base = base.filter((a) => (a.source as string) === "Hermes");
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
