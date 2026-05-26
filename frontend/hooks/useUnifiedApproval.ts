import { useState, useRef, useCallback } from "react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export interface MutationPayload {
  agent_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  description: string;
  surface?: string;
  correlation_id: string;
}

export interface PendingApproval {
  approvalId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  description: string;
  status: "pending" | "approved" | "denied" | "timed_out" | "error";
}

export interface UseUnifiedApprovalResult {
  submitMutation: (payload: MutationPayload) => void;
  pendingApproval: PendingApproval | null;
  isPending: boolean;
  error: string | null;
  sendDecision: (
    approvalId: string,
    decision: "approved" | "denied",
  ) => Promise<void>;
}

export function useUnifiedApproval(): UseUnifiedApprovalResult {
  const [pendingApproval, setPendingApproval] =
    useState<PendingApproval | null>(null);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const closeSSE = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
  }, []);

  const submitMutation = useCallback(
    (payload: MutationPayload) => {
      closeSSE();
      setError(null);
      setPendingApproval(null);

      const requestId = payload.correlation_id;
      const es = new EventSource(
        `${API_BASE_URL}/api/ai/cognition/stream?requestId=${encodeURIComponent(requestId)}`,
      );
      esRef.current = es;

      es.addEventListener("step", (e) => {
        try {
          const step = JSON.parse((e as MessageEvent).data) as {
            kind: string;
            detail?: string;
          };

          if (step.kind === "tool-approval-needed" && step.detail) {
            const detail = JSON.parse(step.detail) as {
              approvalId: string;
              toolName: string;
              toolInput: Record<string, unknown>;
              description: string;
            };
            setPendingApproval({
              approvalId: detail.approvalId,
              toolName: detail.toolName,
              toolInput: detail.toolInput,
              description: detail.description,
              status: "pending",
            });
          }

          if (step.kind === "tool-approval-resolved" && step.detail) {
            const detail = JSON.parse(step.detail) as {
              approvalId: string;
              decision: PendingApproval["status"];
            };
            setPendingApproval((prev) =>
              prev?.approvalId === detail.approvalId
                ? { ...prev, status: detail.decision }
                : prev,
            );
            closeSSE();
          }
        } catch {
          // ignore malformed events
        }
      });

      es.addEventListener("done", closeSSE);

      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED) {
          setError("Approval stream closed unexpectedly");
          closeSSE();
        }
      };
    },
    [closeSSE],
  );

  const sendDecision = useCallback(
    async (approvalId: string, decision: "approved" | "denied") => {
      setPendingApproval((prev) =>
        prev?.approvalId === approvalId ? { ...prev, status: decision } : prev,
      );

      try {
        const res = await fetch(`${API_BASE_URL}/api/harper/tool-decision`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approvalId, decision }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to send decision",
        );
        setPendingApproval((prev) =>
          prev?.approvalId === approvalId
            ? { ...prev, status: "pending" }
            : prev,
        );
      }
    },
    [],
  );

  return {
    submitMutation,
    pendingApproval,
    isPending: pendingApproval?.status === "pending",
    error,
    sendDecision,
  };
}
