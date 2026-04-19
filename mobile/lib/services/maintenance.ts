// [claude-code 2026-04-19] S26-P2 T9: maintenance decision dispatcher. Thin wrapper
//   around POST /api/maintenance/decision so the MaintenanceDetail modal doesn't
//   have to re-implement auth + error plumbing. Mirrors the other mobile/lib/services/
//   helpers in spirit.
const API_BASE = import.meta.env.VITE_API_URL || "";

export type MaintenanceAction =
  | "approve_commit"
  | "approve_and_deploy"
  | "deny";

export interface MaintenanceDecisionResult {
  ok: boolean;
  action?: MaintenanceAction;
  requestId?: string;
  message?: string;
  error?: string;
}

export async function decideMaintenance(
  params: { requestId: string; action: MaintenanceAction },
  token: string | null,
): Promise<MaintenanceDecisionResult> {
  try {
    const res = await fetch(`${API_BASE}/api/maintenance/decision`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      let reason = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body?.error) reason = body.error;
      } catch {
        /* keep status-code fallback */
      }
      return { ok: false, error: reason };
    }
    return (await res.json()) as MaintenanceDecisionResult;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}
