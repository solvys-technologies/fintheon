// [claude-code 2026-04-16] T7: Tool approval state management + decision submission
import { useState, useCallback, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";

const API_BASE = import.meta.env.VITE_API_URL || "";

export interface ToolApproval {
  id: string;
  toolName: string;
  toolInput?: Record<string, unknown>;
  description: string;
  status: "pending" | "approved" | "denied" | "auto";
}

export function useToolApprovals() {
  const { getAccessToken } = useAuth();
  const [approvals, setApprovals] = useState<ToolApproval[]>([]);
  const approvalsRef = useRef(approvals);
  approvalsRef.current = approvals;

  const addApproval = useCallback(
    (event: {
      approvalId: string;
      toolName: string;
      toolInput?: Record<string, unknown>;
      description?: string;
    }) => {
      const approval: ToolApproval = {
        id: event.approvalId,
        toolName: event.toolName,
        toolInput: event.toolInput,
        description: event.description || `Use ${event.toolName}`,
        status: "pending",
      };
      setApprovals((prev) => {
        // Deduplicate by id
        if (prev.some((a) => a.id === approval.id)) return prev;
        return [...prev, approval];
      });
    },
    [],
  );

  const resolveApproval = useCallback(
    async (approvalId: string, decision: "approved" | "denied") => {
      // Optimistic update
      setApprovals((prev) =>
        prev.map((a) => (a.id === approvalId ? { ...a, status: decision } : a)),
      );

      try {
        const token = await getAccessToken();
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        await fetch(`${API_BASE}/api/relay/tool-decision`, {
          method: "POST",
          headers,
          body: JSON.stringify({ approvalId, decision }),
        });
      } catch {
        // Revert on failure
        setApprovals((prev) =>
          prev.map((a) =>
            a.id === approvalId ? { ...a, status: "pending" } : a,
          ),
        );
      }
    },
    [getAccessToken],
  );

  const resolveFromEvent = useCallback(
    (event: { approvalId: string; decision: string }) => {
      setApprovals((prev) =>
        prev.map((a) =>
          a.id === event.approvalId
            ? { ...a, status: event.decision as ToolApproval["status"] }
            : a,
        ),
      );
    },
    [],
  );

  const clearApprovals = useCallback(() => {
    setApprovals([]);
  }, []);

  const pendingApprovals = approvals.filter((a) => a.status === "pending");

  return {
    approvals,
    pendingApprovals,
    addApproval,
    resolveApproval,
    resolveFromEvent,
    clearApprovals,
  };
}
