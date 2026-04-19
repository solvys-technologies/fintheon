// [claude-code 2026-04-19] S26-P2 T9: fetch one maintenance request by id.
//   Mirrors the useToolApprovalById pattern. GET is unauthenticated — the modal
//   renders for everyone, but the action buttons are gated client-side on
//   isSuperAdmin and backend-side on the POST /api/maintenance/decision call.
import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";

export type MaintenanceSeverity = "low" | "medium" | "high" | "critical";

export interface MaintenanceRequest {
  id: string;
  issuePreview: string;
  fixDescription: string;
  severity: MaintenanceSeverity;
  createdAt: string;
  sourceCommit?: string;
}

export function useMaintenanceById(requestId: string | null) {
  const [request, setRequest] = useState<MaintenanceRequest | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(requestId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!requestId) {
      setRequest(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/maintenance/request/${encodeURIComponent(requestId)}`,
        );
        if (!res.ok) {
          if (!cancelled) {
            setError(`Maintenance request not found (${res.status})`);
            setRequest(null);
          }
          return;
        }
        const body = (await res.json()) as { request: MaintenanceRequest };
        if (!cancelled) setRequest(body.request);
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
  }, [requestId]);

  return { request, isLoading, error };
}
