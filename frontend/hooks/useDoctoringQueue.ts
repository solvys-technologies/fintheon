// [claude-code 2026-04-29] S53-T4B: Doctoring queue hook — card-level action
// to flag incidents for the next debug hook cycle.

import { useState, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

export interface DoctoringTicket {
  id: string;
  source: string;
  pipeline: string;
  headline: string;
  reason: string;
  submitted_at: string;
}

interface UseDoctoringQueueResult {
  tickets: DoctoringTicket[];
  loading: boolean;
  submitDoctorate: (params: {
    source: string;
    pipeline?: string;
    headline: string;
    reason?: string;
  }) => Promise<void>;
  fetchTickets: () => Promise<void>;
  clearQueue: () => Promise<void>;
}

export function useDoctoringQueue(): UseDoctoringQueueResult {
  const { getAccessToken } = useAuth();
  const { addToast } = useToast();
  const [tickets, setTickets] = useState<DoctoringTicket[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/api/admin/pipeline-stats/doctorate`, { headers });
      if (res.ok) {
        const data = (await res.json()) as { tickets?: DoctoringTicket[] };
        setTickets(data.tickets ?? []);
      }
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  const submitDoctorate = useCallback(
    async (params: { source: string; pipeline?: string; headline: string; reason?: string }) => {
      try {
        const token = await getAccessToken();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(`${API_BASE}/api/admin/pipeline-stats/doctorate`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            source: params.source,
            pipeline: params.pipeline ?? "manual",
            headline: params.headline,
            reason: params.reason ?? "operator-flagged",
          }),
        });
        if (res.ok) {
          addToast("Incident queued for debug cycle", "success");
          await fetchTickets();
        } else {
          addToast("Failed to queue incident", "error");
        }
      } catch {
        addToast("Backend unreachable", "error");
      }
    },
    [getAccessToken, addToast, fetchTickets],
  );

  const clearQueue = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      await fetch(`${API_BASE}/api/admin/pipeline-stats/doctorate`, {
        method: "DELETE",
        headers,
      });
      setTickets([]);
      addToast("Doctoring queue cleared", "success");
    } catch {
      addToast("Failed to clear queue", "error");
    }
  }, [getAccessToken, addToast]);

  return { tickets, loading, submitDoctorate, fetchTickets, clearQueue };
}
