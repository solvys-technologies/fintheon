// [claude-code 2026-04-10] S9-T2: Extracted filter state from RiskFlowMini
// [claude-code 2026-04-15] S16-T5: Expanded source filters for all pipeline sources
// [claude-code 2026-04-19] RiskFlow card polish: severity filter is now a multi-select Set
//   so the user can stack priorities (e.g. CRIT + HIGH). Empty set = "All". The legacy
//   `severityFilter` / `setSeverityFilter` shims map "all" / "high" / "medium" onto the new
//   set so callers that haven't migrated still compile. Filter state persists to
//   localStorage so refresh / app restart keeps the user's selection.
import { useState, useCallback, useMemo, useEffect } from "react";
import type { AlertSeverity, RiskFlowAlert } from "../lib/riskflow-feed";

const STORAGE_KEY = "fintheon:riskflow-filters:v1";
const VALID_SEVERITIES: ReadonlySet<AlertSeverity> = new Set([
  "critical",
  "high",
  "medium",
  "low",
]);

interface PersistedFilterState {
  severities: AlertSeverity[];
  source: SourceFilter;
  proposals: boolean;
}

function loadPersisted(): PersistedFilterState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedFilterState>;
    const severities = Array.isArray(parsed.severities)
      ? parsed.severities.filter((s): s is AlertSeverity =>
          VALID_SEVERITIES.has(s as AlertSeverity),
        )
      : [];
    const source: SourceFilter =
      typeof parsed.source === "string"
        ? (parsed.source as SourceFilter)
        : "all";
    const proposals = parsed.proposals === true;
    return { severities, source, proposals };
  } catch {
    return null;
  }
}

function savePersisted(state: PersistedFilterState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

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
  /** Multi-select set of severities to show. Empty set = no filter (show all). */
  severitySet: Set<AlertSeverity>;
  toggleSeverity: (s: AlertSeverity) => void;
  clearSeverities: () => void;
  /** Backward-compat single-value view: "all" when set is empty, "high" when {high,critical}, "medium" when {medium}. */
  severityFilter: SeverityFilter;
  setSeverityFilter: (f: SeverityFilter) => void;
  sourceFilter: SourceFilter;
  setSourceFilter: (f: SourceFilter) => void;
  showProposals: boolean;
  setShowProposals: (v: boolean | ((prev: boolean) => boolean)) => void;
  filterAlerts: (alerts: RiskFlowAlert[]) => RiskFlowAlert[];
}

export function useRiskFlowFilters(): UseRiskFlowFiltersReturn {
  const [severitySet, setSeveritySet] = useState<Set<AlertSeverity>>(() => {
    const persisted = loadPersisted();
    return new Set(persisted?.severities ?? []);
  });
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>(() => {
    const persisted = loadPersisted();
    return persisted?.source ?? "all";
  });
  const [showProposals, setShowProposals] = useState<boolean>(() => {
    const persisted = loadPersisted();
    return persisted?.proposals ?? false;
  });

  // Persist any change so refresh / app restart keeps the user's selection.
  useEffect(() => {
    savePersisted({
      severities: Array.from(severitySet),
      source: sourceFilter,
      proposals: showProposals,
    });
  }, [severitySet, sourceFilter, showProposals]);

  const toggleSeverity = useCallback((s: AlertSeverity) => {
    setSeveritySet((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }, []);

  const clearSeverities = useCallback(() => setSeveritySet(new Set()), []);

  const severityFilter: SeverityFilter = useMemo(() => {
    if (severitySet.size === 0) return "all";
    if (severitySet.has("high") || severitySet.has("critical")) return "high";
    if (severitySet.has("medium")) return "medium";
    return "all";
  }, [severitySet]);

  const setSeverityFilter = useCallback((f: SeverityFilter) => {
    if (f === "all") {
      setSeveritySet(new Set());
    } else if (f === "high") {
      setSeveritySet(new Set<AlertSeverity>(["high", "critical"]));
    } else if (f === "medium") {
      setSeveritySet(new Set<AlertSeverity>(["medium"]));
    }
  }, []);

  const filterAlerts = useCallback(
    (alerts: RiskFlowAlert[]): RiskFlowAlert[] => {
      let base = alerts;
      if (showProposals) return base.filter((a) => a.source === "trade-idea");
      if (severitySet.size > 0) {
        base = base.filter((a) => severitySet.has(a.severity));
      }
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
    [severitySet, sourceFilter, showProposals],
  );

  return {
    severitySet,
    toggleSeverity,
    clearSeverities,
    severityFilter,
    setSeverityFilter,
    sourceFilter,
    setSourceFilter,
    showProposals,
    setShowProposals,
    filterAlerts,
  };
}
