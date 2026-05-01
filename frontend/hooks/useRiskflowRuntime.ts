// [claude-code 2026-04-29] S53-T2: Canonical runtime payload hook — composes
// pipeline stats, pipeline state, source accounts, and econ filters into one
// unified status payload. Each module panel consumes a slice; RefinementEngine
// is the single call site so child panels receive consistent data.
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { usePipelineStats, type PipelineRow } from "./usePipelineStats";
import { usePipelineState, type PipelineState } from "./usePipelineState";

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

export interface SourceAccountSummary {
  total: number;
  active: number;
  error: string | null;
}

export interface EconFilterSummary {
  total: number;
  error: string | null;
}

export interface RiskflowRuntimePayload {
  pipelineStats: PipelineRow[];
  pipelineStates: PipelineState[];
  sourceAccounts: SourceAccountSummary;
  econFilters: EconFilterSummary;
  statsLoading: boolean;
  statesLoading: boolean;
  statsError: string | null;
  statesError: string | null;
  lastAppliedAt: Date | null;
  isMutating: boolean;
  degradedReason: string | null;
  refetchStats: () => void;
  togglePipeline: (id: string, enabled: boolean) => void;
}

export function useRiskflowRuntime(): RiskflowRuntimePayload {
  const { getAccessToken } = useAuth();

  const {
    stats: pipelineStats,
    loading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = usePipelineStats();

  const {
    pipelines: pipelineStates,
    loading: statesLoading,
    error: statesError,
    togglePipeline,
  } = usePipelineState();

  const [sourceAccounts, setSourceAccounts] = useState<SourceAccountSummary>({
    total: 0,
    active: 0,
    error: null,
  });
  const [econFilters, setEconFilters] = useState<EconFilterSummary>({
    total: 0,
    error: null,
  });
  const [lastAppliedAt, setLastAppliedAt] = useState<Date | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  const degradedReason = useMemo(() => {
    const reasons: string[] = [];
    if (statsError) reasons.push(`Pipeline stats: ${statsError}`);
    if (statesError) reasons.push(`Pipeline state: ${statesError}`);
    if (sourceAccounts.error)
      reasons.push(`Source accounts: ${sourceAccounts.error}`);
    if (econFilters.error) reasons.push(`Econ filters: ${econFilters.error}`);
    return reasons.length > 0 ? reasons.join("; ") : null;
  }, [statsError, statesError, sourceAccounts.error, econFilters.error]);

  const fetchSourceAccounts = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/api/source-accounts`, { headers });
      if (!res.ok) {
        setSourceAccounts({
          total: 0,
          active: 0,
          error: `Source accounts unavailable (${res.status})`,
        });
        return;
      }
      const json = (await res.json()) as {
        accounts?: { active?: boolean }[];
      };
      const accounts = json.accounts ?? [];
      setSourceAccounts({
        total: accounts.length,
        active: accounts.filter((a) => a.active).length,
        error: null,
      });
    } catch (err) {
      setSourceAccounts({
        total: 0,
        active: 0,
        error:
          err instanceof Error ? err.message : "Failed to load source accounts",
      });
    }
  }, [getAccessToken]);

  const fetchEconFilters = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/api/econ-filters`, { headers });
      if (!res.ok) {
        setEconFilters({
          total: 0,
          error: `Econ filters unavailable (${res.status})`,
        });
        return;
      }
      const json = (await res.json()) as { filters?: unknown[] };
      setEconFilters({
        total: (json.filters ?? []).length,
        error: null,
      });
    } catch (err) {
      setEconFilters({
        total: 0,
        error:
          err instanceof Error ? err.message : "Failed to load econ filters",
      });
    }
  }, [getAccessToken]);

  useEffect(() => {
    void Promise.all([fetchSourceAccounts(), fetchEconFilters()]);
  }, [fetchSourceAccounts, fetchEconFilters]);

  const wrappedToggle = useCallback(
    async (id: string, enabled: boolean) => {
      setIsMutating(true);
      try {
        await togglePipeline(id, enabled);
        setLastAppliedAt(new Date());
      } finally {
        setIsMutating(false);
      }
    },
    [togglePipeline],
  );

  return {
    pipelineStats,
    pipelineStates,
    sourceAccounts,
    econFilters,
    statsLoading,
    statesLoading,
    statsError,
    statesError,
    lastAppliedAt,
    isMutating,
    degradedReason,
    refetchStats,
    togglePipeline: wrappedToggle,
  };
}
