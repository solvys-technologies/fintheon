// [claude-code 2026-04-28] S48-T3: Pipeline stats hook — fetches 24h headline/error counts
// per pipeline from the admin API. Polls every 30s when tab is visible. Degrades to
// empty array on auth failure or network error (backend may not be live yet).
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
  refetch: () => void;
}

export function usePipelineStats(): UsePipelineStatsResult {
  const { getAccessToken } = useAuth();
  const [stats, setStats] = useState<PipelineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/api/admin/pipeline-stats?hours=24`, {
        headers,
      });
      if (!res.ok) {
        setError(`Pipeline stats unavailable (${res.status})`);
        setStats([]);
        return;
      }
      const json = (await res.json()) as { pipelines?: PipelineRow[] };
      setStats(json.pipelines ?? []);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load pipeline stats",
      );
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

  return { stats, loading, error, refetch: fetchStats };
}
