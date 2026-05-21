// [claude-code 2026-05-21] SOL-60: Slim chevron-expandable session history row.
// Columns: Date | P&L | Duration | Win% | ER | right-side P&L gradient sparkline.
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { JournalEntryItem } from "../../lib/services";

interface SessionHistoryRowProps {
  entry: JournalEntryItem;
  isAgentView?: boolean;
}

function formatDateShort(iso: string) {
  const d = new Date(iso + "T12:00:00");
  const mon = d.toLocaleDateString("en-US", { month: "short" });
  const day = String(d.getDate()).padStart(2, "0");
  const dow = d.toLocaleDateString("en-US", { weekday: "short" });
  return `${dow} ${mon} ${day}`;
}

function formatDuration(createdAt: string, updatedAt: string): string {
  const ms = new Date(updatedAt).getTime() - new Date(createdAt).getTime();
  if (ms <= 0) return "—";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function PnLSparkline({ pnl }: { pnl: number }) {
  const isPos = pnl >= 0;
  const color = isPos ? "#34D399" : "#EF4444";
  // 2-point line: flat-then-up for profit, flat-then-down for loss
  const midY = 12;
  const endY = isPos ? 4 : 20;
  return (
    <svg width={40} height={24} viewBox="0 0 40 24" className="shrink-0">
      <defs>
        <linearGradient id={`spark-${isPos ? "pos" : "neg"}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <path
        d={`M0,${midY} L20,${midY} L40,${endY} L40,${midY} L20,${midY} Z`}
        fill={`url(#spark-${isPos ? "pos" : "neg"})`}
      />
      <polyline
        points={`0,${midY} 20,${midY} 40,${endY}`}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SessionHistoryRow({ entry, isAgentView }: SessionHistoryRowProps) {
  const [expanded, setExpanded] = useState(false);

  const pnl = entry.totalPnl ?? 0;
  const pnlColor = pnl >= 0 ? "#34D399" : "#EF4444";
  const pnlStr = `${pnl >= 0 ? "+" : ""}$${Math.abs(pnl).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const duration = formatDuration(entry.createdAt, entry.updatedAt);
  const winPct = entry.winRate != null ? `${entry.winRate.toFixed(0)}%` : "—";
  const erLatest = entry.erTrend?.length
    ? entry.erTrend[entry.erTrend.length - 1]
    : null;
  const erColor =
    erLatest != null
      ? erLatest >= 7
        ? "#34D399"
        : erLatest >= 4
          ? "var(--fintheon-accent)"
          : "#EF4444"
      : "var(--fintheon-muted)";

  return (
    <div
      className="border border-(--fintheon-accent)/10 rounded-lg overflow-hidden"
      style={{ background: "var(--fintheon-surface)" }}
    >
      {/* Collapsed row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-(--fintheon-accent)/5 transition-colors text-left"
      >
        <ChevronRight
          className="w-3.5 h-3.5 text-(--fintheon-muted) shrink-0 transition-transform"
          style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
        />

        {/* Date */}
        <span className="text-[11px] font-mono text-(--fintheon-muted) w-[84px] shrink-0">
          {formatDateShort(entry.date)}
        </span>

        {/* P&L */}
        <span
          className="text-[12px] font-mono font-bold w-[60px] shrink-0 tabular-nums"
          style={{ color: pnlColor }}
        >
          {pnlStr}
        </span>

        {/* Duration */}
        <span className="text-[11px] font-mono text-(--fintheon-muted) w-[44px] shrink-0 tabular-nums">
          {duration}
        </span>

        {/* Win% */}
        <span className="text-[11px] font-mono text-(--fintheon-muted) w-[36px] shrink-0 tabular-nums">
          {isAgentView ? (entry.acceptedCount != null ? `${entry.acceptedCount}ac` : "—") : winPct}
        </span>

        {/* ER */}
        <span
          className="text-[11px] font-mono w-[32px] shrink-0 tabular-nums"
          style={{ color: erColor }}
        >
          {erLatest != null ? erLatest.toFixed(1) : "—"}
        </span>

        {/* Sparkline — right end */}
        <div className="ml-auto shrink-0">
          <PnLSparkline pnl={pnl} />
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-(--fintheon-accent)/8">
          {entry.notes ? (
            <p className="text-[11px] text-(--fintheon-text) leading-relaxed">
              {entry.notes}
            </p>
          ) : (
            <p className="text-[11px] text-(--fintheon-muted) italic">No notes recorded</p>
          )}
          {isAgentView && entry.agentName && (
            <p className="text-[10px] text-(--fintheon-accent) mt-1">{entry.agentName}</p>
          )}
        </div>
      )}
    </div>
  );
}
