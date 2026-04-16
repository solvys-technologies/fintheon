// [claude-code 2026-04-15] S19: Mobile boardroom DAG hook — dispatch + SSE streaming of agent output
import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";

const API_BASE = import.meta.env.VITE_API_URL || "";

// ── Types (mirrored from backend-hono agent-bus types) ──

type HermesAgentId = "oracle" | "feucht" | "consul" | "herald" | "harper";

interface AgentOutput {
  agentId: HermesAgentId;
  text: string;
  status: "pending" | "streaming" | "complete" | "error";
}

interface DAGProgress {
  currentWave: number;
  totalWaves: number;
}

interface BoardroomDAGState {
  dagId: string | null;
  status: "idle" | "dispatching" | "running" | "complete" | "error";
  agentOutputs: Record<string, AgentOutput>;
  progress: DAGProgress;
  synthesis: string | null;
  error: string | null;
}

interface UseBoardroomDAGReturn extends BoardroomDAGState {
  dispatch: (message: string, agents?: HermesAgentId[]) => Promise<void>;
  cancel: () => Promise<void>;
  reset: () => void;
}

const INITIAL_STATE: BoardroomDAGState = {
  dagId: null,
  status: "idle",
  agentOutputs: {},
  progress: { currentWave: 0, totalWaves: 3 },
  synthesis: null,
  error: null,
};

const DEFAULT_AGENTS: HermesAgentId[] = [
  "oracle",
  "feucht",
  "consul",
  "herald",
  "harper",
];

// ── Hook ──

export function useBoardroomDAG(): UseBoardroomDAGReturn {
  const { getAccessToken } = useAuth();
  const [state, setState] = useState<BoardroomDAGState>(INITIAL_STATE);
  const esRef = useRef<EventSource | null>(null);

  // SSE connection — enabled only while a DAG is running
  useEffect(() => {
    if (
      !state.dagId ||
      (state.status !== "running" && state.status !== "dispatching")
    ) {
      return;
    }

    const url = `${API_BASE}/api/boardroom/dag/${state.dagId}/stream`;
    const es = new EventSource(url);
    esRef.current = es;

    const EVENT_NAMES = [
      "agent-start",
      "agent-delta",
      "agent-complete",
      "agent-error",
      "dag-start",
      "dag-wave",
      "dag-complete",
      "dag-error",
    ];

    const handleEvent = (ev: MessageEvent) => {
      if (!ev.data?.trim()) return;
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(ev.data);
      } catch {
        return;
      }

      setState((prev) => {
        const type = parsed.type as string;

        // Agent events
        if (type?.startsWith("agent-")) {
          const agentId = parsed.agentId as string;
          const existing = prev.agentOutputs[agentId] ?? {
            agentId,
            text: "",
            status: "pending" as const,
          };

          let updated: AgentOutput;
          if (type === "agent-start") {
            updated = { ...existing, status: "streaming" };
          } else if (type === "agent-delta") {
            updated = {
              ...existing,
              text:
                existing.text +
                (typeof parsed.data === "string" ? parsed.data : ""),
              status: "streaming",
            };
          } else if (type === "agent-complete") {
            updated = { ...existing, status: "complete" };
          } else {
            updated = { ...existing, status: "error" };
          }

          return {
            ...prev,
            status: "running",
            agentOutputs: { ...prev.agentOutputs, [agentId]: updated },
          };
        }

        // DAG events
        if (type === "dag-start") return { ...prev, status: "running" };
        if (type === "dag-wave") {
          return {
            ...prev,
            progress: {
              currentWave: parsed.wave as number,
              totalWaves: Math.max(
                prev.progress.totalWaves,
                (parsed.wave as number) + 1,
              ),
            },
          };
        }
        if (type === "dag-complete") {
          const harperOutput = prev.agentOutputs["harper"];
          return {
            ...prev,
            status: "complete",
            synthesis: harperOutput?.text ?? null,
          };
        }
        if (type === "dag-error") {
          return { ...prev, status: "error", error: "DAG execution failed" };
        }

        return prev;
      });
    };

    for (const name of EVENT_NAMES) {
      es.addEventListener(name, handleEvent as EventListener);
    }

    es.onerror = () => {
      es.close();
      esRef.current = null;
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [state.dagId, state.status]);

  // Dispatch a new DAG
  const dispatch = useCallback(
    async (message: string, agents?: HermesAgentId[]) => {
      const agentList = agents ?? DEFAULT_AGENTS;

      setState({
        ...INITIAL_STATE,
        status: "dispatching",
        agentOutputs: agentList.reduce<Record<string, AgentOutput>>(
          (acc, id) => {
            acc[id] = { agentId: id, text: "", status: "pending" };
            return acc;
          },
          {},
        ),
      });

      try {
        const token = await getAccessToken();
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`${API_BASE}/api/boardroom/dag`, {
          method: "POST",
          headers,
          body: JSON.stringify({ message, agents: agentList }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { dagId: string };

        setState((prev) => ({ ...prev, dagId: body.dagId, status: "running" }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          status: "error",
          error: err instanceof Error ? err.message : "Dispatch failed",
        }));
      }
    },
    [getAccessToken],
  );

  // Cancel
  const cancel = useCallback(async () => {
    if (!state.dagId) return;
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      await fetch(`${API_BASE}/api/boardroom/dag/${state.dagId}/cancel`, {
        method: "POST",
        headers,
      });
    } catch {}
    esRef.current?.close();
    setState((prev) => ({ ...prev, status: "idle" }));
  }, [state.dagId, getAccessToken]);

  // Reset
  const reset = useCallback(() => {
    esRef.current?.close();
    setState(INITIAL_STATE);
  }, []);

  return { ...state, dispatch, cancel, reset };
}

export type { HermesAgentId, AgentOutput, BoardroomDAGState };
