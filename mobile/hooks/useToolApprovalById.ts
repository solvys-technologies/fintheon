// [claude-code 2026-04-19] S25: fetch one pending approval by id for the DetailSheet.
//   Polls once on mount; parent component handles re-fetching on resolution via cognition SSE.
import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

const API_BASE = import.meta.env.VITE_API_URL || "";

export interface ToolApproval {
  id: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  description: string;
  createdAt: number;
}

export interface ApprovalResponse {
  approval: ToolApproval;
  expiresAt: number | null;
  serverNow: number;
}

export function useToolApprovalById(approvalId: string | null) {
  const { getAccessToken } = useAuth();
  const [data, setData] = useState<ApprovalResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(approvalId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!approvalId) {
      setData(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch(
          `${API_BASE}/api/harper/approvals/${encodeURIComponent(approvalId)}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          },
        );
        if (!res.ok) {
          if (!cancelled) {
            setError(`Approval not found (${res.status})`);
            setData(null);
          }
          return;
        }
        const body = (await res.json()) as ApprovalResponse;
        if (!cancelled) setData(body);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Fetch failed");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [approvalId, getAccessToken]);

  return { data, isLoading, error };
}
