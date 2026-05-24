// [claude-code 2026-03-28] S8-T3: Added constellation ropes between related commandments
import { useState, useRef, useEffect } from "react";
import {
  Lock,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { COMMANDMENTS } from "./commandments-data";
import type { Commandment, CommandmentBlockLevel } from "./types";

const BLOCK_ICON: Record<
  CommandmentBlockLevel,
  { icon: typeof Lock; color: string; label: string }
> = {
  hard: { icon: Lock, color: "text-red-400", label: "HARD" },
  soft: {
    icon: AlertTriangle,
    color: "text-[var(--fintheon-accent)]/60",
    label: "SOFT",
  },
  guidance: {
    icon: Info,
    color: "text-[var(--fintheon-text)]/30",
    label: "GUIDE",
  },
};

function CommandmentItem({ cmd }: { cmd: Commandment }) {
  const [expanded, setExpanded] = useState(false);
  const block = BLOCK_ICON[cmd.blockLevel];
  const BlockIcon = block.icon;

  return (
    <div
      className={`rounded transition-colors ${
        expanded ? "bg-[var(--fintheon-accent)]/5" : ""
      }`}
    >
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-start gap-1.5 text-left py-1 px-1 rounded hover:bg-[var(--fintheon-accent)]/5"
      >
        <span className="text-[11px] font-bold text-[var(--fintheon-accent)]/50 shrink-0 w-5 text-right font-mono mt-px">
          {cmd.number}.
        </span>
        <BlockIcon size={10} className={`${block.color} shrink-0 mt-[3px]`} />
        <span className="text-[12px] text-[var(--fintheon-text)]/70 leading-relaxed font-mono flex-1">
          {cmd.text}
        </span>
        {expanded ? (
          <ChevronDown
            size={8}
            className="text-[var(--fintheon-accent)]/30 shrink-0 mt-[3px]"
          />
        ) : (
          <ChevronRight
            size={8}
            className="text-[var(--fintheon-accent)]/20 shrink-0 mt-[3px]"
          />
        )}
      </button>

      {expanded && (
        <div className="pl-8 pr-2 pb-2 space-y-1.5 animate-fade-in-tab">
          <p className="text-[13px] text-[var(--fintheon-text)]/50 leading-relaxed">
            {cmd.fullText}
          </p>

          {cmd.backgroundStory && (
            <p className="text-[11px] text-[var(--fintheon-text)]/35 leading-relaxed italic border-l border-[var(--fintheon-accent)]/15 pl-2">
              {cmd.backgroundStory}
            </p>
          )}

          {cmd.mentorSource && (
            <div className="text-[9px] text-[var(--fintheon-accent)]/40 font-mono italic">
              -- {cmd.mentorSource}
            </div>
          )}

          <div className="flex flex-wrap gap-1">
            <span
              className={`text-[8px] font-mono px-1 py-0.5 rounded border ${
                cmd.blockLevel === "hard"
                  ? "border-red-500/30 text-red-400 bg-red-500/5"
                  : cmd.blockLevel === "soft"
                    ? "border-[var(--fintheon-accent)]/20 text-[var(--fintheon-accent)]/50"
                    : "border-[var(--fintheon-text)]/10 text-[var(--fintheon-text)]/30"
              }`}
            >
              {block.label} BLOCK
            </span>
            {cmd.relatedCommandments.map((n) => (
              <span
                key={n}
                className="text-[8px] font-mono px-1 py-0.5 rounded border border-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)]/30"
              >
                C{n}
              </span>
            ))}
          </div>

          {Object.entries(cmd.agentUsage).length > 0 && (
            <div className="space-y-0.5 pt-0.5">
              {Object.entries(cmd.agentUsage).map(([agent, usage]) => (
                <div key={agent} className="flex gap-1">
                  <span className="text-[9px] text-[var(--fintheon-accent)]/40 font-mono shrink-0">
                    {agent}:
                  </span>
                  <span className="text-[9px] text-[var(--fintheon-text)]/35">
                    {usage}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Constellation Ropes — SVG connections between related commandments ─────
function ConstellationRopes({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [lines, setLines] = useState<
    { x1: number; y1: number; x2: number; y2: number; key: string }[]
  >([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Wait for DOM to settle then compute positions
    const timer = setTimeout(() => {
      const pairs: { from: number; to: number }[] = [];
      const seen = new Set<string>();
      for (const cmd of COMMANDMENTS) {
        for (const rel of cmd.relatedCommandments) {
          const k = [Math.min(cmd.number, rel), Math.max(cmd.number, rel)].join(
            "-",
          );
          if (!seen.has(k)) {
            seen.add(k);
            pairs.push({ from: cmd.number, to: rel });
          }
        }
      }

      const containerRect = container.getBoundingClientRect();
      const newLines: typeof lines = [];
      for (const { from, to } of pairs) {
        const fromEl = container.querySelector(`[data-cmd="${from}"]`);
        const toEl = container.querySelector(`[data-cmd="${to}"]`);
        if (!fromEl || !toEl) continue;
        const fRect = fromEl.getBoundingClientRect();
        const tRect = toEl.getBoundingClientRect();
        newLines.push({
          x1: fRect.left - containerRect.left + fRect.width - 4,
          y1: fRect.top - containerRect.top + fRect.height / 2,
          x2: tRect.left - containerRect.left + tRect.width - 4,
          y2: tRect.top - containerRect.top + tRect.height / 2,
          key: `${from}-${to}`,
        });
      }
      setLines(newLines);
    }, 100);

    return () => clearTimeout(timer);
  }, [containerRef]);

  if (lines.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none overflow-visible"
      style={{ zIndex: 1 }}
    >
      {lines.map((l, i) => {
        const mx = l.x1 + (l.x2 - l.x1) * 0.5 + 12;
        const my = l.y1 + (l.y2 - l.y1) * 0.5;
        return (
          <path
            key={l.key}
            d={`M ${l.x1} ${l.y1} Q ${mx} ${my} ${l.x2} ${l.y2}`}
            fill="none"
            stroke="var(--fintheon-accent)"
            strokeWidth={0.6}
            opacity={0.15}
            className="rope-breathe"
            style={{ animationDelay: `${(i % 5) * 0.7}s` }}
          />
        );
      })}
    </svg>
  );
}

export function CommandmentsSidebar() {
  const hardCount = COMMANDMENTS.filter((c) => c.blockLevel === "hard").length;
  const listRef = useRef<HTMLDivElement>(null);

  return (
    <div className="fintheon-rail-surface w-[260px] shrink-0 flex flex-col overflow-y-auto">
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Lock size={12} className="text-[var(--fintheon-accent)]/60" />
            <span className="text-[16px] font-semibold text-[var(--fintheon-accent)] tracking-[0.15em] uppercase">
              Rules of Engagement
            </span>
          </div>
          <span className="text-[7px] font-mono text-red-400/50">
            {hardCount} hard
          </span>
        </div>
        <div
          ref={listRef}
          className="fintheon-liquid-surface relative p-2 space-y-0.5"
        >
          <ConstellationRopes containerRef={listRef} />
          {COMMANDMENTS.map((cmd) => (
            <div key={cmd.number} data-cmd={cmd.number}>
              <CommandmentItem cmd={cmd} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
