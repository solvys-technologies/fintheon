// [claude-code 2026-04-19] Routines Console — mobile Superadmin approval queue.
// Polls /api/routines/approvals/pending so the FAB can glow when something needs sign-off.

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

const API_BASE = import.meta.env.VITE_API_URL || "";
const POLL_MS = 20_000;

export interface RoutineApproval {
  id: string;
  triggerId: string;
  routineRunId: string | null;
  opsEntryId: string | null;
  title: string;
  payload: Record<string, unknown>;
  status: "pending" | "approved" | "denied";
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
}

interface FetchResult {
  approvals: RoutineApproval[];
}

export function useRoutineApprovals() {
  const { getAccessToken } = useAuth();
  const [approvals, setApprovals] = useState<RoutineApproval[]>([]);
  const [loading, setLoading] = useState(false);

  const authedFetch = useCallback(
    async (input: string, init?: RequestInit) => {
      const token = await getAccessToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...((init?.headers as Record<string, string>) ?? {}),
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      return fetch(input, { ...init, headers });
    },
    [getAccessToken],
  );

  const refresh = useCallback(async () => {
    if (!API_BASE) return;
    setLoading(true);
    try {
      const res = await authedFetch(
        `${API_BASE}/api/routines/approvals/pending`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as FetchResult;
      setApprovals(data.approvals ?? []);
    } catch {
      /* network — keep last list */
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (mounted) await refresh();
    })();
    const t = setInterval(refresh, POLL_MS);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [refresh]);

  const resolve = useCallback(
    async (id: string, action: "approve" | "deny") => {
      // Optimistic
      setApprovals((prev) => prev.filter((a) => a.id !== id));
      try {
        await authedFetch(
          `${API_BASE}/api/routines/approvals/${id}/${action}`,
          {
            method: "POST",
            body: JSON.stringify({ resolvedBy: "mobile-superadmin" }),
          },
        );
      } finally {
        await refresh();
      }
    },
    [authedFetch, refresh],
  );

  return {
    approvals,
    pendingCount: approvals.length,
    loading,
    refresh,
    approve: (id: string) => resolve(id, "approve"),
    deny: (id: string) => resolve(id, "deny"),
  };
}
