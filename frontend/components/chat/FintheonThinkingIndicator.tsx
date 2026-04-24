import { useState, useEffect } from "react";
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
        {/* Pulse dot — Solvys gold on dim bg */}
        <div className="mt-0.5 h-6 w-6 flex-shrink-0 flex items-center justify-center">
          <span
            style={{
              display: "inline-block",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "#c79f4a",
              animation: "p 1.5s ease-in-out infinite",
            }}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="text-[12px] font-medium"
              style={{ color: "var(--fintheon-accent)" }}
            >
              {phrase}
            </span>
            {agentName && (
              <span className="text-[10px] text-zinc-500">({agentName})</span>
            )}
          </div>

          {thinkingContent && (
            <div className="mt-1.5">
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {expanded ? (
                  <ChevronDown size={12} />
                ) : (
                  <ChevronRight size={12} />
                )}
                {expanded ? "Hide thinking pane" : "Show thinking pane"}
              </button>
              {expanded && (
                <div className="mt-1.5 max-h-[180px] overflow-y-auto pl-2 text-[11px] leading-relaxed text-zinc-400 whitespace-pre-wrap">
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
