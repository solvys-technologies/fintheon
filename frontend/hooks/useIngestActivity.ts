// [claude-code 2026-04-29] S53-T4B: Ingest activity hook — polls the "Everything
// timeline" endpoint for operator visibility into every poll attempt and feed decision.

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

export interface IngestLedgerEntry {
  id: number;
  source: string;
  pipeline: string;
  decision: string;
  reason: string;
  headline_preview?: string;
  timestamp: string;
}

export interface LeakSentinel {
  rejected_non_allowlisted: number;
  blocked_before_feed: number;
  unexpected_feed_insertions: number;
  last_leak_event_at: string | null;
  last_leak_detail: string | null;
}

export interface ContinuityHealth {
  econ_expected: number;
  econ_received: number;
  commentary_expected: number;
  commentary_received: number;
  last_econ_ingest_at: string | null;
  last_commentary_ingest_at: string | null;
  econ_stalled: boolean;
  commentary_stalled: boolean;
}

export interface AllowlistSnapshot {
  handles: string[];
  domains: string[];
}

export interface IngestActivityPayload {
  entries: IngestLedgerEntry[];
  leak_sentinel: LeakSentinel;
  continuity: ContinuityHealth;
  allowlist?: AllowlistSnapshot;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useIngestActivity(): IngestActivityPayload {
  const { getAccessToken } = useAuth();
  const [entries, setEntries] = useState<IngestLedgerEntry[]>([]);
  const [leakSentinel, setLeakSentinel] = useState<LeakSentinel>({
    rejected_non_allowlisted: 0,
    blocked_before_feed: 0,
    unexpected_feed_insertions: 0,
    last_leak_event_at: null,
    last_leak_detail: null,
  });
  const [continuity, setContinuity] = useState<ContinuityHealth>({
    econ_expected: 0,
    econ_received: 0,
    commentary_expected: 0,
    commentary_received: 0,
    last_econ_ingest_at: null,
    last_commentary_ingest_at: null,
    econ_stalled: false,
    commentary_stalled: false,
  });
  const [allowlist, setAllowlist] = useState<AllowlistSnapshot>({ handles: [], domains: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivity = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const [activityRes, runtimeRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/pipeline-stats/ingest-activity?limit=100`, { headers }),
        fetch(`${API_BASE}/api/admin/pipeline-stats/runtime`, { headers }),
      ]);

      if (activityRes.ok) {
        const data = (await activityRes.json()) as {
          entries?: IngestLedgerEntry[];
          leak_sentinel?: LeakSentinel;
          continuity?: ContinuityHealth;
        };
        setEntries(data.entries ?? []);
        if (data.leak_sentinel) setLeakSentinel(data.leak_sentinel);
        if (data.continuity) setContinuity(data.continuity);
      }

      if (runtimeRes.ok) {
        const data = (await runtimeRes.json()) as {
          leak_sentinel?: LeakSentinel;
          continuity?: ContinuityHealth;
          allowlist?: AllowlistSnapshot;
        };
        if (data.leak_sentinel) setLeakSentinel(data.leak_sentinel);
        if (data.continuity) setContinuity(data.continuity);
        if (data.allowlist) setAllowlist(data.allowlist);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ingest activity");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      if (mounted) setLoading(true);
      await fetchActivity();
    })();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void fetchActivity();
    }, 30_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [fetchActivity]);

  return { entries, leak_sentinel: leakSentinel, continuity, allowlist, loading, error, refetch: fetchActivity };
}
