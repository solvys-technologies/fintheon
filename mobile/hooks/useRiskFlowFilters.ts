// [claude-code 2026-04-15] T5: UI-only filter state — client-side filtering on loaded alerts
// [claude-code 2026-04-19] Polish pass: severity filter is now multi-select (Set). Empty
//   set = "All". Selection persists to localStorage so app restart / PWA reopen keeps the
//   user's filter choice. Mirrors the desktop multi-select model.
// [claude-code 2026-04-19] Source filter collapsed into 5 buckets (OSINT / General /
//   Commentary / Econ / Geopolitical) matching the desktop surface. Old per-source
//   `activeSources: Set<string>` is migrated into the new `activeBuckets: Set<SourceBucket>`
//   at load time so persisted state carries over cleanly.
// [claude-code 2026-04-26] S46: severities + buckets sync via SettingsContext →
//   /api/preferences so the same selection follows the user across desktop + mobile.
//   localStorage stays as offline cache + one-time migration source.
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import type { AlertSeverity } from "@frontend/lib/riskflow-feed";
import type { MobileRiskFlowAlert } from "../contexts/RiskFlowContext";
import {
  bucketOf,
  matchesBuckets,
  type SourceBucket,
} from "../lib/source-buckets";
import { useSettings } from "../contexts/SettingsContext";

interface UseRiskFlowFiltersOptions {
  alerts: MobileRiskFlowAlert[];
}

const STORAGE_KEY = "fintheon-mobile:riskflow-filters:v2";
const VALID_SEVERITIES: ReadonlySet<AlertSeverity> = new Set([
  "critical",
  "high",
  "medium",
  "low",
]);
const VALID_BUCKETS: ReadonlySet<SourceBucket> = new Set([
  "Wire",
  "Macro",
  "OSINT",
  "Commentary",
  "Econ",
  "Geopolitical",
]);

interface PersistedState {
  severities: AlertSeverity[];
  buckets: SourceBucket[];
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
    const buckets = Array.isArray(parsed.buckets)
      ? parsed.buckets.filter((b): b is SourceBucket =>
          VALID_BUCKETS.has(b as SourceBucket),
        )
      : [];
    return { severities, buckets };
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

export function useRiskFlowFilters({ alerts }: UseRiskFlowFiltersOptions) {
  const { preferences, setPreferences } = useSettings();
  const remoteFilters = preferences.riskflowFilters;

  const [activeSeverities, setActiveSeverities] = useState<Set<AlertSeverity>>(
    () => {
      const persisted = loadPersisted();
      return new Set(persisted?.severities ?? []);
    },
  );
  const [activeBuckets, setActiveBuckets] = useState<Set<SourceBucket>>(() => {
    const persisted = loadPersisted();
    return new Set(persisted?.buckets ?? []);
  });

  // Server preferences are the source of truth once loaded. First reconcile
  // adopts the remote selection if present; otherwise migrates the user's
  // existing localStorage selection up to the server one time.
  const reconciled = useRef(false);
  useEffect(() => {
    if (reconciled.current) return;
    if (preferences.updatedAt === new Date(0).toISOString()) return;
    reconciled.current = true;
    if (remoteFilters) {
      setActiveSeverities(new Set(remoteFilters.severities as AlertSeverity[]));
      setActiveBuckets(new Set(remoteFilters.buckets as SourceBucket[]));
      return;
    }
    const persisted = loadPersisted();
    if (
      persisted &&
      (persisted.severities.length || persisted.buckets.length)
    ) {
      void setPreferences({
        riskflowFilters: {
          severities: persisted.severities,
          buckets: persisted.buckets,
        },
      });
    }
  }, [preferences.updatedAt, remoteFilters, setPreferences]);

  useEffect(() => {
    if (!reconciled.current || !remoteFilters) return;
    const remoteSev = new Set(remoteFilters.severities as AlertSeverity[]);
    const remoteBucket = new Set(remoteFilters.buckets as SourceBucket[]);
    setActiveSeverities((prev) =>
      setsEqual(prev, remoteSev) ? prev : remoteSev,
    );
    setActiveBuckets((prev) =>
      setsEqual(prev, remoteBucket) ? prev : remoteBucket,
    );
  }, [remoteFilters]);

  useEffect(() => {
    savePersisted({
      severities: Array.from(activeSeverities),
      buckets: Array.from(activeBuckets),
    });
    if (!reconciled.current) return;
    const sev = Array.from(activeSeverities);
    const buc = Array.from(activeBuckets);
    const remoteSev = remoteFilters?.severities ?? [];
    const remoteBuc = remoteFilters?.buckets ?? [];
    if (arraysEqual(sev, remoteSev) && arraysEqual(buc, remoteBuc)) return;
    void setPreferences({
      riskflowFilters: { severities: sev, buckets: buc },
    });
  }, [activeSeverities, activeBuckets, remoteFilters, setPreferences]);

  const toggleSeverity = useCallback((level: AlertSeverity) => {
    setActiveSeverities((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  }, []);

  const clearSeverities = useCallback(() => setActiveSeverities(new Set()), []);

  const toggleBucket = useCallback((bucket: SourceBucket) => {
    setActiveBuckets((prev) => {
      const next = new Set(prev);
      if (next.has(bucket)) next.delete(bucket);
      else next.add(bucket);
      return next;
    });
  }, []);

  const clearBuckets = useCallback(() => setActiveBuckets(new Set()), []);

  const clearFilters = useCallback(() => {
    setActiveSeverities(new Set());
    setActiveBuckets(new Set());
  }, []);

  const filtered = useMemo(() => {
    let result = alerts;
    if (activeSeverities.size > 0) {
      result = result.filter((a) => activeSeverities.has(a.severity));
    }
    if (activeBuckets.size > 0) {
      result = result.filter((a) =>
        matchesBuckets(
          {
            source: a.source,
            riskType: a.riskType,
            submittedBy: a.submittedBy,
          },
          activeBuckets,
        ),
      );
    }
    return result;
  }, [alerts, activeSeverities, activeBuckets]);

  const bucketCounts = useMemo(() => {
    const counts: Partial<Record<SourceBucket, number>> = {};
    for (const a of alerts) {
      const b = bucketOf({
        source: a.source,
        riskType: a.riskType,
        submittedBy: a.submittedBy,
      });
      counts[b] = (counts[b] ?? 0) + 1;
    }
    return counts;
  }, [alerts]);

  return {
    filtered,
    activeSeverities,
    activeBuckets,
    bucketCounts,
    toggleSeverity,
    clearSeverities,
    toggleBucket,
    clearBuckets,
    clearFilters,
  };
}
