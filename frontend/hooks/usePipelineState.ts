// [claude-code 2026-04-28] S48-T3: Pipeline state hook — fetches admin pipeline registry
// and exposes optimistic toggle with revert-on-failure. Gated on Supabase JWT.
// [claude-code 2026-04-29] S53-T2: Evolved with lastAppliedAt and degradedReason
// for module-level runtime status display.
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

export interface PipelineState {
  pipeline_id: string;
  label: string;
  description?: string;
  enabled: boolean;
}

interface UsePipelineStateResult {
  pipelines: PipelineState[];
  loading: boolean;
  error: string | null;
  lastAppliedAt: Date | null;
  degradedReason: string | null;
  togglePipeline: (id: string, enabled: boolean) => Promise<void>;
}

export function usePipelineState(): UsePipelineStateResult {
  const { getAccessToken } = useAuth();
  const { addToast } = useToast();
  const [pipelines, setPipelines] = useState<PipelineState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastAppliedAt, setLastAppliedAt] = useState<Date | null>(null);
  const [degradedReason, setDegradedReason] = useState<string | null>(null);

  const fetchPipelines = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/api/admin/pipelines`, { headers });
      if (!res.ok) {
        const msg = `Pipeline registry unavailable (${res.status})`;
        setError(msg);
        setDegradedReason(msg);
        setPipelines([]);
        return;
      }
      const json = (await res.json()) as { pipelines?: PipelineState[] };
      setPipelines(json.pipelines ?? []);
      setError(null);
      setDegradedReason(null);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to load pipeline states";
      setError(msg);
      setDegradedReason(msg);
      setPipelines([]);
    }
  }, [getAccessToken]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      if (mounted) setLoading(true);
      await fetchPipelines();
      if (mounted) setLoading(false);
    })();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void fetchPipelines();
    }, 30_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [fetchPipelines]);

  const togglePipeline = useCallback(
    async (id: string, enabled: boolean) => {
      const prev = pipelines.find((p) => p.pipeline_id === id);
      if (!prev) return;
      const previousValue = prev.enabled;

      setPipelines((prevList) =>
        prevList.map((p) => (p.pipeline_id === id ? { ...p, enabled } : p)),
      );

      try {
        const token = await getAccessToken();
        if (!token) {
          setPipelines((prevList) =>
            prevList.map((p) =>
              p.pipeline_id === id ? { ...p, enabled: previousValue } : p,
            ),
          );
          setDegradedReason("Sign in required to toggle pipelines");
          addToast("Sign in required to toggle pipelines", "info");
          return;
        }
        const res = await fetch(`${API_BASE}/api/admin/pipelines/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ enabled }),
        });
        if (!res.ok) {
          setPipelines((prevList) =>
            prevList.map((p) =>
              p.pipeline_id === id ? { ...p, enabled: previousValue } : p,
            ),
          );
          setDegradedReason(`Toggle failed (${res.status})`);
          addToast(
            `Failed to toggle pipeline`,
            "error",
            `Status ${res.status}`,
          );
          return;
        }
        setLastAppliedAt(new Date());
        setDegradedReason(null);
      } catch (err) {
        setPipelines((prevList) =>
          prevList.map((p) =>
            p.pipeline_id === id ? { ...p, enabled: previousValue } : p,
          ),
        );
        const msg = err instanceof Error ? err.message : String(err);
        setDegradedReason(`Backend unreachable: ${msg}`);
        addToast("Backend unreachable", "error", msg);
      }
    },
    [pipelines, getAccessToken, addToast],
  );

  return {
    pipelines,
    loading,
    error,
    lastAppliedAt,
    degradedReason,
    togglePipeline,
  };
}
