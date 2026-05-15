import { useState, useEffect, useCallback } from "react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export interface AuditRecord {
  id?: string;
  agent_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  description: string;
  surface: string;
  correlation_id: string;
  decision: "approved" | "denied" | "timed_out";
  reason: string | null;
  created_at?: string;
  created_by?: string | null;
  logged_at?: string;
}

export interface AuditQueryFilters {
  agentId?: string;
  surface?: string;
  decision?: "approved" | "denied" | "timed_out";
  limit?: number;
  offset?: number;
}

export interface UseAuditLogResult {
  rows: AuditRecord[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAuditLog(filters?: AuditQueryFilters): UseAuditLogResult {
  const [rows, setRows] = useState<AuditRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const agentId = filters?.agentId;
  const surface = filters?.surface;
  const decision = filters?.decision;
  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (agentId) params.set("agentId", agentId);
    if (surface) params.set("surface", surface);
    if (decision) params.set("decision", decision);
    params.set("limit", String(limit));
    params.set("offset", String(offset));

    fetch(`${API_BASE_URL}/api/audit/log?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ rows: AuditRecord[]; total: number }>;
      })
      .then((json) => {
        if (cancelled) return;
        setRows(json.rows ?? []);
        setTotal(json.total ?? 0);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load audit log");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [agentId, surface, decision, limit, offset, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  return { rows, total, isLoading, error, refetch };
}
