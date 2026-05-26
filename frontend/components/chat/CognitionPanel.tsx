// [claude-code 2026-04-24] cognition label redesign — label change, dot removal,
//   Streamdown-rendered thinking stream, slow semi-unsteady shimmer on phrases.
// [claude-code 2026-03-10] Agent cognition visualization — real-time step-by-step process panel
// Connects to /api/ai/cognition/stream SSE and renders agent pipeline steps as they arrive.
// Solvys Gold palette: BG #050402, Accent #c79f4a, Text #f0ead6. No gradients, no colored emojis.

import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "./constants.js";
import { BrailleSpinner } from "./primitive/BrailleSpinner";

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

const THINKING_PHRASES = [
  "Surveying the arena...",
  "Running risk models...",
  "Reviewing the legion's positions...",
  "Consulting the Consilium...",
  "Analyzing macro data...",
  "Checking volatility surface...",
  "Evaluating sentiment...",
  "Processing market signals...",
  "Cross-referencing events...",
  "Calculating exposure...",
  "Mapping liquidity pockets...",
  "Tracking implied vol drift...",
  "Pricing catalyst risk...",
  "Calibrating entry zones...",
  "Stress-testing conviction...",
];

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

function currentStepPhrase(step: CognitionStep): string {
  const detail = parseDetail(step.detail);
  const label = step.label?.trim();
  if (label && !label.startsWith("chat-ui:")) return label;
  if (detail) return detail;
  return stepLabel(step);
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
        window.dispatchEvent(
          new CustomEvent("fintheon:cognition-step", {
            detail: { requestId, step },
          }),
        );
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
  const [collapsed, setCollapsed] = useState(true);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const toolLogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isStreaming || done) return;
    const interval = setInterval(() => {
      setPhraseIndex((i) => (i + 1) % THINKING_PHRASES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [done, isStreaming]);

  useEffect(() => {
    if (requestId) {
      setCollapsed(true);
      setPhraseIndex(0);
    }
  }, [requestId]);

  const toolSteps = useMemo(
    () =>
      steps.filter((step) => isToolStep(step) && step.kind !== "gateway-call"),
    [steps],
  );

  useEffect(() => {
    const node = toolLogRef.current;
    if (!node || collapsed) return;
    node.scrollTop = node.scrollHeight;
  }, [collapsed, toolSteps.length]);

  if (!requestId || steps.length === 0) return null;

  const latestVisibleStep = [...steps]
    .reverse()
    .find((step) => step.kind !== "gateway-call");
  const currentPhrase =
    isStreaming && !done
      ? latestVisibleStep
        ? currentStepPhrase(latestVisibleStep)
        : THINKING_PHRASES[phraseIndex]
      : "Thought trail";

  return (
    <div className="overflow-hidden bg-transparent">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center gap-2 px-1 py-1 text-left transition-colors duration-200 hover:text-[var(--fintheon-accent)]"
        aria-expanded={!collapsed}
        title={collapsed ? "Show tool calls" : "Hide tool calls"}
      >
        <span className="flex h-[23px] w-[23px] shrink-0 items-center justify-center">
          <BrailleSpinner size={10.35} />
        </span>
        <span className="min-w-0">
          <span
            className={
              "block truncate text-[13.8px] font-medium text-[var(--fintheon-accent)]/78" +
              (isStreaming && !done ? " cognition-thought-shimmer" : "")
            }
          >
            {currentPhrase}
          </span>
        </span>
      </button>

      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
          collapsed
            ? "grid-rows-[0fr] opacity-0"
            : "grid-rows-[1fr] opacity-100"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            ref={toolLogRef}
            className="max-h-[30vh] space-y-1.5 overflow-y-auto px-7 pb-2 pr-2"
          >
            {toolSteps.map((step, i) => {
              const detail = parseDetail(step.detail);
              return (
                <div
                  key={`${step.ts}-${i}`}
                  className="grid grid-cols-[7.5rem_1fr] items-start gap-2 rounded-md bg-black/18 px-2.5 py-2 text-[10.5px] leading-4 text-[var(--fintheon-text)]/68 transition-colors duration-200 hover:bg-black/28"
                >
                  <span className="font-mono uppercase tracking-[0.12em] text-[var(--fintheon-accent)]/68">
                    {stepLabel(step)}
                  </span>
                  <span className="min-w-0 break-words font-mono text-[var(--fintheon-text)]/56">
                    {detail || "queued"}
                  </span>
                </div>
              );
            })}
            {toolSteps.length === 0 && (
              <div className="rounded-md bg-black/18 px-2.5 py-2 text-[10.5px] leading-4 text-[var(--fintheon-text)]/48">
                Waiting for tool calls.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
