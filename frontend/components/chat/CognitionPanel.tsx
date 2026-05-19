// [claude-code 2026-04-24] "thought for" redesign — label change, dot removal,
//   Streamdown-rendered thinking stream, slow semi-unsteady shimmer on phrases.
// [claude-code 2026-03-10] Agent cognition visualization — real-time step-by-step process panel
// Connects to /api/ai/cognition/stream SSE and renders agent pipeline steps as they arrive.
// Solvys Gold palette: BG #050402, Accent #c79f4a, Text #f0ead6. No gradients, no colored emojis.

import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "./constants.js";
import { RichTextRenderer } from "../shared/RichTextRenderer";

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
  "gateway-call": "Gateway call",
  "gateway-fallback": "Gateway fallback",
  "response-ready": "Response ready",
  error: "Error",
};

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function stepToText(s: CognitionStep): string {
  const prefix = KIND_PHRASE[s.kind] ?? s.kind;
  const detail = s.detail
    ? s.kind === "tool-dispatch" || s.kind === "gateway-call"
      ? ` \`${s.detail}\``
      : ` — ${s.detail}`
    : "";
  const dur = s.durationMs !== undefined ? ` (${s.durationMs}ms)` : "";
  return `${prefix}${detail ? ":" : ""}${detail}${dur}`;
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

  if (!requestId || steps.length === 0) return null;

  return (
    <div className="rounded-2xl bg-[var(--fintheon-bg)]/90 overflow-hidden transition-all">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <span
            className={
              "text-[10px] font-medium tracking-wider lowercase text-[var(--fintheon-accent)]/70" +
              (stillThinking ? " cognition-thought-shimmer" : "")
            }
          >
            thought for
          </span>
          <span className="text-[10px] text-[var(--fintheon-text)]/55 tabular-nums">
            {formatElapsed(elapsedMs)}
          </span>
        </div>
        <span
          className="text-[var(--fintheon-text)]/25 text-[10px]"
          style={{
            display: "inline-block",
            transform: collapsed ? "rotate(-90deg)" : "rotate(0)",
            transition: "transform var(--t-icon-swap-dur) var(--t-icon-swap-ease)",
          }}
        >
          ▾
        </span>
      </button>

      {!collapsed && (
        <div className="px-3 pb-2.5">
          <div
            className={
              "text-[11px] leading-relaxed text-[var(--fintheon-text)]/75 space-y-1" +
              (stillThinking ? " cognition-thought-shimmer" : "")
            }
          >
            {steps.map((s, i) => (
              <RichTextRenderer key={i} text={stepToText(s)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
