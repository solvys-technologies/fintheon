// [claude-code 2026-04-28] S48-T3: Pipeline stats hook — fetches 24h headline/error counts
// per pipeline from the admin API. Polls every 30s when tab is visible. Degrades to
// empty array on auth failure or network error (backend may not be live yet).
// [claude-code 2026-04-29] S53-T2: Evolved with degradedReason for module-level
// runtime status display per canonical backend payload.
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

export interface PipelineRow {
  pipeline_id: string;
  label: string;
  enabled: boolean;
  headlineCount: number;
  errorCount: number;
  lastSuccessAt: string | null;
  uptimePct: number;
}

interface UsePipelineStatsResult {
  stats: PipelineRow[];
  loading: boolean;
  error: string | null;
  degradedReason: string | null;
  refetch: () => void;
}

export function usePipelineStats(): UsePipelineStatsResult {
  const { getAccessToken } = useAuth();
  const [stats, setStats] = useState<PipelineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [degradedReason, setDegradedReason] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/api/admin/pipeline-stats?hours=24`, {
        headers,
      });
      if (!res.ok) {
        const msg = `Pipeline stats unavailable (${res.status})`;
        setError(msg);
        setDegradedReason(msg);
        setStats([]);
        return;
      }
      const json = (await res.json()) as { pipelines?: PipelineRow[] };
      const rows = json.pipelines ?? [];
      setStats(rows);
      setError(null);
      // Degraded if any pipeline has uptime below threshold
      const degraded = rows.filter((r) => r.enabled && r.uptimePct < 95);
      setDegradedReason(
        degraded.length > 0
          ? `${degraded.length} pipeline(s) below 95% uptime`
          : null,
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to load pipeline stats";
      setError(msg);
      setDegradedReason(msg);
      setStats([]);
    }
  }, [getAccessToken]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      if (mounted) setLoading(true);
      await fetchStats();
      if (mounted) setLoading(false);
    })();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void fetchStats();
    }, 30_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [fetchStats]);

  return { stats, loading, error, degradedReason, refetch: fetchStats };
}
