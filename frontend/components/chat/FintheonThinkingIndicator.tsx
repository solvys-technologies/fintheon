// [claude-code 2026-04-25] v5.29.2 hotfix: replaced the pulsing gold dot with
//   the Nothing-design AiLoader (segmented horizontal indeterminate fuse) and
//   re-keyed all colors to --fintheon-accent / --fintheon-text so the strip is
//   theme-sensitive. Pane label updated from "thinking pane" to "Thought".
import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

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

interface FintheonThinkingIndicatorProps {
  isThinking: boolean;
  thinkingContent?: string;
  agentName?: string;
}

export function FintheonThinkingIndicator({
  isThinking,
  thinkingContent,
  agentName,
}: FintheonThinkingIndicatorProps) {
  const [phrase, setPhrase] = useState(THINKING_PHRASES[0]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isThinking) return;
    let idx = 0;
    setPhrase(THINKING_PHRASES[0]);
    const interval = setInterval(() => {
      idx = (idx + 1) % THINKING_PHRASES.length;
      setPhrase(THINKING_PHRASES[idx]);
    }, 2000);
    return () => clearInterval(interval);
  }, [isThinking]);

  return (
    <div
      className="w-full rounded-xl fintheon-thinking-container-borderless overflow-hidden transition-all duration-300 ease-in-out"
      style={{
        maxHeight: isThinking ? "200px" : "0px",
        opacity: isThinking ? 1 : 0,
        padding: isThinking ? "10px 12px" : "0px 12px",
      }}
    >
      <div className="flex items-start gap-3">
        <NothingFuseStrip />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="text-[12px] font-medium"
              style={{ color: "var(--fintheon-accent)" }}
            >
              {phrase}
            </span>
            {agentName && (
              <span
                className="text-[10px]"
                style={{
                  color:
                    "color-mix(in oklab, var(--fintheon-text) 45%, transparent)",
                }}
              >
                ({agentName})
              </span>
            )}
          </div>

          {thinkingContent && (
            <div className="mt-1.5">
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 text-[11px] transition-colors"
                style={{
                  color:
                    "color-mix(in oklab, var(--fintheon-text) 50%, transparent)",
                }}
              >
                {expanded ? (
                  <ChevronDown size={12} />
                ) : (
                  <ChevronRight size={12} />
                )}
                {expanded ? "Hide Thought" : "Show Thought"}
              </button>
              {expanded && (
                <div
                  className="mt-1.5 max-h-[180px] overflow-y-auto pl-2 text-[11px] leading-relaxed whitespace-pre-wrap"
                  style={{
                    color:
                      "color-mix(in oklab, var(--fintheon-text) 60%, transparent)",
                  }}
                >
                  {thinkingContent}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Nothing-design horizontal segmented fuse — same primitive used by the chat
// AiLoader. 3-segment cluster slides L→R on a 10-segment track at 1500ms.
const STRIP_WIDTH = 56;
const STRIP_HEIGHT = 3;
const CLUSTER_PERIOD_MS = 1500;
const CLUSTER_SEGMENTS = 3;
const TRACK_SEGMENTS = 10;

function NothingFuseStrip() {
  const clusterRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = clusterRef.current;
    if (!node) return;
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) return;
    const animation = node.animate(
      [{ transform: "translateX(-30%)" }, { transform: "translateX(100%)" }],
      {
        duration: CLUSTER_PERIOD_MS,
        iterations: Infinity,
        easing: "cubic-bezier(0.45, 0, 0.55, 1)",
      },
    );
    return () => animation.cancel();
  }, []);

  const segWidth = STRIP_WIDTH / TRACK_SEGMENTS;
  const clusterWidth = segWidth * CLUSTER_SEGMENTS - 2;

  return (
    <div className="mt-1 flex-shrink-0">
      <div
        className="relative overflow-hidden rounded-sm"
        style={{
          width: STRIP_WIDTH,
          height: STRIP_HEIGHT,
          background:
            "color-mix(in oklab, var(--fintheon-accent) 12%, transparent)",
        }}
      >
        <div
          ref={clusterRef}
          className="absolute top-0 left-0 h-full"
          style={{ width: clusterWidth }}
        >
          <div
            className="h-full w-full rounded-sm"
            style={{ background: "var(--fintheon-accent)" }}
          />
        </div>
      </div>
    </div>
  );
}
