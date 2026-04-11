// [claude-code 2026-04-10] S8-T4: Boardroom DAG execution hook — dispatch + live SSE state machine
import { useState, useCallback, useEffect } from "react";
import { useAgentBusSSE } from "./useAgentBusSSE";
import type {
  AgentStreamEvent,
  DAGProgressEvent,
  HermesAgentId,
} from "../../backend-hono/src/services/agent-bus/types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentOutput {
  agentId: HermesAgentId;
  text: string;
  status: "pending" | "streaming" | "complete" | "error";
}

interface DAGProgress {
  currentWave: number;
  totalWaves: number;
  tasks: Array<{ id: string; agentId: HermesAgentId; status: string }>;
}

interface BoardroomDAGState {
  dagId: string | null;
  status: "idle" | "dispatching" | "running" | "complete" | "error";
  agentOutputs: Record<string, AgentOutput>;
  progress: DAGProgress;
  /** Final synthesis text from Harper */
  synthesis: string | null;
  error: string | null;
}

interface UseBoardroomDAGReturn extends BoardroomDAGState {
  /** Dispatch a new Boardroom DAG */
  dispatch: (message: string, agents?: HermesAgentId[]) => Promise<void>;
  /** Cancel the running DAG */
  cancel: () => Promise<void>;
  /** Reset to idle (clear outputs) */
  reset: () => void;
}

type SSEEvent = AgentStreamEvent | DAGProgressEvent;

// ── Initial state ──────────────────────────────────────────────────────────────

const INITIAL_PROGRESS: DAGProgress = {
  currentWave: 0,
  totalWaves: 3,
  tasks: [],
};

const INITIAL_STATE: BoardroomDAGState = {
  dagId: null,
  status: "idle",
  agentOutputs: {},
  progress: INITIAL_PROGRESS,
  synthesis: null,
  error: null,
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useBoardroomDAG(
  conversationId: string,
  userId: string,
): UseBoardroomDAGReturn {
  const [state, setState] = useState<BoardroomDAGState>(INITIAL_STATE);

  // SSE subscription — enabled only while a DAG is running
  const sseEnabled =
    state.dagId !== null &&
    (state.status === "running" || state.status === "dispatching");

  const { lastEvent } = useAgentBusSSE<SSEEvent>({
    url: state.dagId
      ? `${API_BASE}/api/boardroom/dag/${state.dagId}/stream`
      : "",
    enabled: sseEnabled,
    reconnect: true,
  });

  // Process incoming SSE events
  useEffect(() => {
    if (!lastEvent) return;

    setState((prev) => {
      const ev = lastEvent;

      // ── AgentStreamEvent ──────────────────────────────────────────────────
      if (
        ev.type === "agent-start" ||
        ev.type === "agent-delta" ||
        ev.type === "agent-complete" ||
        ev.type === "agent-error"
      ) {
        const e = ev as AgentStreamEvent;
        const existing = prev.agentOutputs[e.agentId] ?? {
          agentId: e.agentId,
          text: "",
          status: "pending" as const,
        };

        let updated: AgentOutput;
        if (e.type === "agent-start") {
          updated = { ...existing, status: "streaming" };
        } else if (e.type === "agent-delta") {
          updated = {
            ...existing,
            text: existing.text + (typeof e.data === "string" ? e.data : ""),
            status: "streaming",
          };
        } else if (e.type === "agent-complete") {
          updated = { ...existing, status: "complete" };
        } else {
          // agent-error
          updated = { ...existing, status: "error" };
        }

        return {
          ...prev,
          status: "running",
          agentOutputs: { ...prev.agentOutputs, [e.agentId]: updated },
        };
      }

      // ── DAGProgressEvent ──────────────────────────────────────────────────
      if (
        ev.type === "dag-start" ||
        ev.type === "dag-wave" ||
        ev.type === "dag-complete" ||
        ev.type === "dag-error"
      ) {
        const e = ev as DAGProgressEvent;

        if (e.type === "dag-start") {
          return { ...prev, status: "running" };
        }

        if (e.type === "dag-wave") {
          return {
            ...prev,
            progress: {
              currentWave: e.wave,
              totalWaves: Math.max(prev.progress.totalWaves, e.wave + 1),
              tasks: e.tasks.map((t) => ({
                id: t.id,
                agentId: t.agentId,
                status: t.status,
              })),
            },
          };
        }

        if (e.type === "dag-complete") {
          // Extract Harper synthesis from agentOutputs
          const harperOutput = prev.agentOutputs["harper"];
          return {
            ...prev,
            status: "complete",
            synthesis: harperOutput?.text ?? null,
          };
        }

        if (e.type === "dag-error") {
          return { ...prev, status: "error", error: "DAG execution failed" };
        }
      }

      return prev;
    });
  }, [lastEvent]);

  // ── dispatch ──────────────────────────────────────────────────────────────

  const dispatch = useCallback(
    async (message: string, agents?: HermesAgentId[]) => {
      setState((prev) => ({
        ...INITIAL_STATE,
        status: "dispatching",
        // Seed pending entries for all expected agents
        agentOutputs: (
          agents ??
          ([
            "oracle",
            "feucht",
            "consul",
            "herald",
            "harper",
          ] as HermesAgentId[])
        ).reduce<Record<string, AgentOutput>>((acc, id) => {
          acc[id] = { agentId: id, text: "", status: "pending" };
          return acc;
        }, {}),
        dagId: prev.dagId, // keep old dagId momentarily until we get new one
      }));

      try {
        const res = await fetch(`${API_BASE}/api/boardroom/dag`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            conversationId: conversationId || undefined,
            userId: userId || undefined,
            agents,
          }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { dagId: string };

        setState((prev) => ({ ...prev, dagId: body.dagId, status: "running" }));

        // Notify ConsiliumHub of running state via custom event
        window.dispatchEvent(
          new CustomEvent("fintheon:boardroom-dag-running", {
            detail: { running: true },
          }),
        );
      } catch (err) {
        setState((prev) => ({
          ...prev,
          status: "error",
          error: err instanceof Error ? err.message : "Dispatch failed",
        }));
      }
    },
    [conversationId, userId],
  );

  // ── cancel ────────────────────────────────────────────────────────────────

  const cancel = useCallback(async () => {
    if (!state.dagId) return;
    try {
      await fetch(`${API_BASE}/api/dag/${state.dagId}/cancel`, {
        method: "POST",
      });
    } catch {
      // best-effort
    }
    setState((prev) => ({ ...prev, status: "idle" }));
    window.dispatchEvent(
      new CustomEvent("fintheon:boardroom-dag-running", {
        detail: { running: false },
      }),
    );
  }, [state.dagId]);

  // ── Notify hub when DAG reaches terminal state ────────────────────────────

  useEffect(() => {
    if (state.status === "complete" || state.status === "error") {
      window.dispatchEvent(
        new CustomEvent("fintheon:boardroom-dag-running", {
          detail: { running: false },
        }),
      );
    }
  }, [state.status]);

  // ── reset ─────────────────────────────────────────────────────────────────

  const reset = useCallback(() => setState(INITIAL_STATE), []);

  return { ...state, dispatch, cancel, reset };
}
