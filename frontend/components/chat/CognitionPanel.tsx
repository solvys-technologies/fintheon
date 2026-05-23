// [claude-code 2026-04-24] cognition label redesign — label change, dot removal,
//   Streamdown-rendered thinking stream, slow semi-unsteady shimmer on phrases.
// [claude-code 2026-03-10] Agent cognition visualization — real-time step-by-step process panel
// Connects to /api/ai/cognition/stream SSE and renders agent pipeline steps as they arrive.
// Solvys Gold palette: BG #050402, Accent #c79f4a, Text #f0ead6. No gradients, no colored emojis.

import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "./constants.js";

export type CognitionStepKind =
  | "agent-route"
  | "context-build"
  | "skill-check"
  | "tool-dispatch"
  | "tool-approval-needed"
  | "tool-approval-resolved"
  | "gateway-call"
  | "gateway-fallback"
  | "response-ready"
  | "error";

export interface CognitionStep {
  kind: CognitionStepKind;
  label: string;
  detail?: string;
  durationMs?: number;
  ts: number;
}

interface Props {
  requestId: string | null;
  isStreaming: boolean;
}

const KIND_PHRASE: Record<CognitionStepKind, string> = {
  "agent-route": "Routing",
  "context-build": "Building context",
  "skill-check": "Skill check",
  "tool-dispatch": "Calling tool",
  "tool-approval-needed": "Awaiting approval",
  "tool-approval-resolved": "Approval resolved",
  "gateway-call": "Calling Tools...",
  "gateway-fallback": "Gateway fallback",
  "response-ready": "Response ready",
  error: "Error",
};

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function parseDetail(detail: string | undefined): string {
  if (!detail) return "";
  const trimmed = detail.trim();
  if (!trimmed.startsWith("{")) return trimmed;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const command = typeof parsed.command === "string" ? parsed.command : null;
    const path = typeof parsed.path === "string" ? parsed.path : null;
    const query = typeof parsed.query === "string" ? parsed.query : null;
    const label = command ?? path ?? query;
    return label ? label : trimmed;
  } catch {
    return trimmed;
  }
}

function stepLabel(step: CognitionStep): string {
  if (step.kind === "tool-dispatch") return "Tool call";
  if (step.kind === "gateway-call") return "Calling Tools...";
  return KIND_PHRASE[step.kind] ?? step.kind;
}

function isToolStep(step: CognitionStep): boolean {
  return (
    step.kind === "tool-dispatch" ||
    step.kind === "gateway-call" ||
    step.kind === "gateway-fallback" ||
    step.kind === "tool-approval-needed" ||
    step.kind === "tool-approval-resolved"
  );
}

export function useCognitionStream(requestId: string | null) {
  const [steps, setSteps] = useState<CognitionStep[]>([]);
  const [done, setDone] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!requestId) {
      setSteps([]);
      setDone(false);
      return;
    }

    esRef.current?.close();
    setSteps([]);
    setDone(false);

    const es = new EventSource(
      `${API_BASE_URL}/api/ai/cognition/stream?requestId=${encodeURIComponent(requestId)}`,
    );
    esRef.current = es;

    es.addEventListener("step", (e) => {
      try {
        const step = JSON.parse(e.data) as CognitionStep;
        setSteps((s) => [...s, step]);
      } catch {
        /* ignore malformed */
      }
    });

    es.addEventListener("done", () => {
      setDone(true);
      es.close();
    });

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [requestId]);

  return { steps, done };
}

export function CognitionPanel({ requestId, isStreaming }: Props) {
  const { steps, done } = useCognitionStream(requestId);
  const [collapsed, setCollapsed] = useState(false);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (done || !isStreaming) return;
    const t = setInterval(() => setNow(Date.now()), 120);
    return () => clearInterval(t);
  }, [done, isStreaming]);

  const elapsedMs = useMemo(() => {
    if (steps.length === 0) return 0;
    const start = steps[0].ts;
    const end = done ? steps[steps.length - 1].ts : now;
    return Math.max(0, end - start);
  }, [steps, done, now]);

  useEffect(() => {
    if (done && steps.length > 0 && !steps.some((s) => s.kind === "error")) {
      const t = setTimeout(() => setCollapsed(true), 4_000);
      return () => clearTimeout(t);
    }
  }, [done, steps]);

  useEffect(() => {
    if (requestId) setCollapsed(false);
  }, [requestId]);

  const stillThinking = isStreaming && !done;
  const visibleSteps = steps.filter((step) => step.kind !== "response-ready");
  const toolCount = visibleSteps.filter(isToolStep).length;

  if (!requestId || visibleSteps.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.055] bg-[#0b0b09] shadow-[0_18px_48px_rgba(0,0,0,0.24)] transition-colors duration-300">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors duration-200 hover:bg-white/[0.025]"
        aria-expanded={!collapsed}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={
              "text-[10px] font-medium tracking-[0.14em] uppercase text-[var(--fintheon-accent)]/72" +
              (stillThinking ? " cognition-thought-shimmer" : "")
            }
          >
            Calling Tools...
          </span>
          <span className="truncate text-[10px] text-[var(--fintheon-text)]/42">
            {toolCount || visibleSteps.length} {toolCount === 1 ? "call" : "calls"}
          </span>
          <span className="text-[10px] text-[var(--fintheon-text)]/55 tabular-nums">
            {formatElapsed(elapsedMs)}
          </span>
        </div>
      </button>

      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
          collapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-1.5 px-3 pb-2.5">
            {visibleSteps.map((step, i) => {
              const detail = parseDetail(step.detail);
              return (
                <div
                  key={`${step.ts}-${i}`}
                  className="grid grid-cols-[7.5rem_1fr_auto] items-start gap-2 rounded-md bg-black/20 px-2.5 py-2 text-[10.5px] leading-4 text-[var(--fintheon-text)]/68 transition-colors duration-200 hover:bg-black/30"
                >
                  <span className="font-mono uppercase tracking-[0.12em] text-[var(--fintheon-accent)]/68">
                    {stepLabel(step)}
                  </span>
                  <span className="min-w-0 break-words font-mono text-[var(--fintheon-text)]/56">
                    {detail || "queued"}
                  </span>
                  <span className="font-mono tabular-nums text-[var(--fintheon-text)]/34">
                    {step.durationMs !== undefined
                      ? formatElapsed(step.durationMs)
                      : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
