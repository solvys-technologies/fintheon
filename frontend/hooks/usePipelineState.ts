// [claude-code 2026-04-28] S48-T3: Pipeline state hook — fetches admin pipeline registry
// and exposes optimistic toggle with revert-on-failure. Gated on Supabase JWT.
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
  togglePipeline: (id: string, enabled: boolean) => void;
}

export function usePipelineState(): UsePipelineStateResult {
  const { getAccessToken } = useAuth();
  const { addToast } = useToast();
  const [pipelines, setPipelines] = useState<PipelineState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPipelines = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/api/admin/pipelines`, { headers });
      if (!res.ok) {
        setError(`Pipeline registry unavailable (${res.status})`);
        setPipelines([]);
        return;
      }
      const json = (await res.json()) as { pipelines?: PipelineState[] };
      setPipelines(json.pipelines ?? []);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load pipeline states",
      );
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

      // Optimistic update
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
          addToast(
            `Failed to toggle pipeline`,
            "error",
            `Status ${res.status}`,
          );
        }
      } catch (err) {
        setPipelines((prevList) =>
          prevList.map((p) =>
            p.pipeline_id === id ? { ...p, enabled: previousValue } : p,
          ),
        );
        addToast(
          "Backend unreachable",
          "error",
          err instanceof Error ? err.message : String(err),
        );
      }
    },
    [pipelines, getAccessToken, addToast],
  );

  return { pipelines, loading, error, togglePipeline };
}
