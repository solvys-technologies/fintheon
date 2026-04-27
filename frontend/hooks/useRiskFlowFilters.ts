// [claude-code 2026-04-10] S9-T2: Extracted filter state from RiskFlowMini
// [claude-code 2026-04-15] S16-T5: Expanded source filters for all pipeline sources
// [claude-code 2026-04-19] RiskFlow card polish: severity filter is now a multi-select Set
//   so the user can stack priorities (e.g. CRIT + HIGH). Empty set = "All". The legacy
//   `severityFilter` / `setSeverityFilter` shims map "all" / "high" / "medium" onto the new
//   set so callers that haven't migrated still compile. Filter state persists to
//   localStorage so refresh / app restart keeps the user's selection.
// [claude-code 2026-04-19] Source filter collapsed from 7 raw sources into 5 buckets
//   (OSINT / General / Commentary / Econ / Geopolitical) via bucketOf(). Severity
//   stays multi-select; source is now also multi-select. Backward-compat
//   `sourceFilter: SourceFilter` / `setSourceFilter` shim preserves the old
//   single-value "twitter" / "financial-juice" etc. API for any holdover callers.
// [claude-code 2026-04-26] S46: severities + buckets now flow through SettingsContext
//   → /api/preferences so the same selection follows the user across desktop/mobile/web.
//   localStorage stays as an offline cache + one-time migration source for users whose
//   pre-S46 selections live there. `showProposals` stays local — it's a session toggle.
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { AlertSeverity, RiskFlowAlert } from "../lib/riskflow-feed";
import {
  bucketOf,
  matchesBuckets,
  type SourceBucket,
} from "../lib/source-buckets";
import { useSettings } from "../contexts/SettingsContext";

const STORAGE_KEY = "fintheon:riskflow-filters:v2";
const VALID_SEVERITIES: ReadonlySet<AlertSeverity> = new Set([
  "critical",
  "high",
  "medium",
  "low",
]);
const VALID_BUCKETS: ReadonlySet<SourceBucket> = new Set([
  "OSINT",
  "General",
  "Commentary",
  "Econ",
  "Geopolitical",
]);

interface PersistedFilterState {
  severities: AlertSeverity[];
  buckets: SourceBucket[];
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
    const buckets = Array.isArray(parsed.buckets)
      ? parsed.buckets.filter((b): b is SourceBucket =>
          VALID_BUCKETS.has(b as SourceBucket),
        )
      : [];
    const proposals = parsed.proposals === true;
    return { severities, buckets, proposals };
  } catch {
    return null;
  }
}

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function arraysEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  for (const v of a) if (!setB.has(v)) return false;
  return true;
}

function savePersisted(state: PersistedFilterState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export type SeverityFilter = "all" | "high" | "medium";
// [claude-code 2026-04-19] Legacy single-value source filter kept for back-compat.
// New callers should use `bucketSet` / `toggleBucket` instead.
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
  /** Backward-compat single-value view. */
  severityFilter: SeverityFilter;
  setSeverityFilter: (f: SeverityFilter) => void;
  /** Multi-select set of source buckets (OSINT / General / Commentary / Econ / Geopolitical). */
  bucketSet: Set<SourceBucket>;
  toggleBucket: (b: SourceBucket) => void;
  clearBuckets: () => void;
  /** Legacy single-value source filter — set-only shim, reads always return "all". */
  sourceFilter: SourceFilter;
  setSourceFilter: (f: SourceFilter) => void;
  showProposals: boolean;
  setShowProposals: (v: boolean | ((prev: boolean) => boolean)) => void;
  filterAlerts: (alerts: RiskFlowAlert[]) => RiskFlowAlert[];
}

export function useRiskFlowFilters(): UseRiskFlowFiltersReturn {
  const { preferences, updatePreferences } = useSettings();
  const remoteFilters = preferences.riskflowFilters;

  const [severitySet, setSeveritySet] = useState<Set<AlertSeverity>>(() => {
    const persisted = loadPersisted();
    return new Set(persisted?.severities ?? []);
  });
  const [bucketSet, setBucketSet] = useState<Set<SourceBucket>>(() => {
    const persisted = loadPersisted();
    return new Set(persisted?.buckets ?? []);
  });
  const [showProposals, setShowProposals] = useState<boolean>(() => {
    const persisted = loadPersisted();
    return persisted?.proposals ?? false;
  });

  // Reconcile with server preferences. First sync after preferences load
  // (updatedAt > epoch) wins — local state is overwritten with the server's
  // truth. If the server has nothing yet but localStorage has a v2 selection,
  // push the localStorage state up once so it propagates to other devices.
  const reconciled = useRef(false);
  useEffect(() => {
    if (reconciled.current) return;
    if (preferences.updatedAt === new Date(0).toISOString()) return;
    reconciled.current = true;
    if (remoteFilters) {
      setSeveritySet(new Set(remoteFilters.severities));
      setBucketSet(new Set(remoteFilters.buckets));
      return;
    }
    const persisted = loadPersisted();
    if (
      persisted &&
      (persisted.severities.length || persisted.buckets.length)
    ) {
      updatePreferences({
        riskflowFilters: {
          severities: persisted.severities,
          buckets: persisted.buckets,
        },
      });
    }
  }, [preferences.updatedAt, remoteFilters, updatePreferences]);

  // React to cross-device updates from the 30s preferences poll.
  useEffect(() => {
    if (!reconciled.current || !remoteFilters) return;
    const remoteSev = new Set(remoteFilters.severities);
    const remoteBucket = new Set(remoteFilters.buckets);
    setSeveritySet((prev) => (setsEqual(prev, remoteSev) ? prev : remoteSev));
    setBucketSet((prev) =>
      setsEqual(prev, remoteBucket) ? prev : remoteBucket,
    );
  }, [remoteFilters]);

  useEffect(() => {
    savePersisted({
      severities: Array.from(severitySet),
      buckets: Array.from(bucketSet),
      proposals: showProposals,
    });
    if (!reconciled.current) return;
    const sev = Array.from(severitySet);
    const buc = Array.from(bucketSet);
    const remoteSev = remoteFilters?.severities ?? [];
    const remoteBuc = remoteFilters?.buckets ?? [];
    if (arraysEqual(sev, remoteSev) && arraysEqual(buc, remoteBuc)) {
      return;
    }
    updatePreferences({
      riskflowFilters: { severities: sev, buckets: buc },
    });
  }, [severitySet, bucketSet, showProposals, remoteFilters, updatePreferences]);

  const toggleSeverity = useCallback((s: AlertSeverity) => {
    setSeveritySet((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }, []);

  const clearSeverities = useCallback(() => setSeveritySet(new Set()), []);

  const toggleBucket = useCallback((b: SourceBucket) => {
    setBucketSet((prev) => {
      const next = new Set(prev);
      if (next.has(b)) next.delete(b);
      else next.add(b);
      return next;
    });
  }, []);

  const clearBuckets = useCallback(() => setBucketSet(new Set()), []);

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

  // Legacy source-filter shim. Maps the old single-value filter onto the new
  // bucket set so components that still call `setSourceFilter("twitter")`
  // compile and produce roughly equivalent behavior (twitter → General).
  const setSourceFilter = useCallback((f: SourceFilter) => {
    if (f === "all") {
      setBucketSet(new Set());
      return;
    }
    const mapped: SourceBucket | null =
      f === "osint"
        ? "OSINT"
        : f === "hermes"
          ? "Commentary"
          : f === "econ-calendar" || f === "polymarket-kalshi"
            ? "Econ"
            : f === "twitter" || f === "financial-juice" || f === "deitaone"
              ? "General"
              : null;
    setBucketSet(mapped ? new Set<SourceBucket>([mapped]) : new Set());
  }, []);

  const filterAlerts = useCallback(
    (alerts: RiskFlowAlert[]): RiskFlowAlert[] => {
      let base = alerts;
      if (showProposals) return base.filter((a) => a.source === "trade-idea");
      if (severitySet.size > 0) {
        base = base.filter((a) => severitySet.has(a.severity));
      }
      if (bucketSet.size > 0) {
        base = base.filter((a) =>
          matchesBuckets(
            { source: a.source as string, riskType: a.riskType },
            bucketSet,
          ),
        );
      }
      return base;
    },
    [severitySet, bucketSet, showProposals],
  );

  return {
    severitySet,
    toggleSeverity,
    clearSeverities,
    severityFilter,
    setSeverityFilter,
    bucketSet,
    toggleBucket,
    clearBuckets,
    sourceFilter: "all",
    setSourceFilter,
    showProposals,
    setShowProposals,
    filterAlerts,
  };
}

// Re-export for components that want to reason about buckets.
export { bucketOf };
export type { SourceBucket };
