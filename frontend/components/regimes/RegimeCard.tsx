// [claude-code 2026-04-15] T2: RegimeCard — glass-wrapped regime card with decomposed subcomponents
// [claude-code 2026-04-15] T3: Added RegimeMiniChat integration at card bottom
import { Clock, Trash2, Diff, TrendingDown } from "lucide-react";
import { GlassEffect } from "../ui/liquid-glass";
import { BiasBadge } from "./BiasBadge";
import { ConfidenceBar } from "./ConfidenceBar";
import { OrbRecord } from "./OrbRecord";
import { RegimeMiniChat } from "./RegimeMiniChat";
import { formatTimeRange12H } from "../../lib/regime-time";
import type { TradingRegime } from "../../lib/regimes";

interface RegimeCardProps {
  regime: TradingRegime;
  isActive: boolean;
  timeInfo: string;
  onRecordBullish: () => void;
  onRecordBearish: () => void;
  onDelete: () => void;
  onExpandToSidebar?: () => void;
}

export function RegimeCard({
  regime,
  isActive,
  timeInfo,
  onRecordBullish,
  onRecordBearish,
  onDelete,
  onExpandToSidebar,
}: RegimeCardProps) {
  return (
    <GlassEffect
      className="rounded-2xl"
      style={
        isActive
          ? {
              borderColor: "var(--fintheon-accent)",
              boxShadow: "0 0 16px rgba(212,175,55,0.12)",
            }
          : undefined
      }
    >
      <div className="px-4 py-3">
        {/* Header */}
        <div className="flex items-start justify-between mb-1.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--fintheon-text)] truncate">
                {regime.name}
              </span>
              {isActive && (
                <span className="shrink-0 inline-flex items-center gap-1 text-[8px] font-bold tracking-wider uppercase text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/10 px-1.5 py-0.5">
                  <span className="w-1 h-1 rounded-full bg-[var(--fintheon-accent)] animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
            <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2">
              {regime.description}
            </p>
          </div>
          <button
            onClick={onDelete}
            className="shrink-0 p-1 text-zinc-700 hover:text-red-400 transition-colors"
            title="Delete regime"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <span className="text-[9px] text-zinc-500 flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            {formatTimeRange12H(regime.timeRange.start, regime.timeRange.end)}
          </span>
          <span className="text-[9px] text-zinc-600">
            {regime.daysActive.join(", ")}
          </span>
          <BiasBadge bias={regime.bias} />
          {regime.source && (
            <span className="text-[9px] text-zinc-600 italic">
              {regime.source}
            </span>
          )}
        </div>

        {/* Instruments */}
        <div className="flex items-center gap-1 mb-2">
          {regime.instruments.map((inst) => (
            <span
              key={inst}
              className="text-[9px] bg-zinc-800/60 text-zinc-400 px-1.5 py-0.5"
            >
              {inst}
            </span>
          ))}
        </div>

        {/* Confidence bar */}
        <div className="mb-2">
          <ConfidenceBar value={regime.confidence} />
        </div>

        {/* Stats + actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <OrbRecord record={regime.record} orbHistory={regime.orbHistory} />
            <span className="text-[9px] text-zinc-600">
              {regime.daysObserved}d observed
            </span>
            <span className="text-[9px] text-[var(--fintheon-accent)]/60">
              {timeInfo}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onRecordBullish}
              className="flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-semibold text-[var(--fintheon-bullish)] bg-[var(--fintheon-bullish)]/10 hover:bg-[var(--fintheon-bullish)]/20 transition-colors"
              title="Record Bullish ORB Day"
            >
              <Diff className="w-2.5 h-2.5" />
            </button>
            <button
              onClick={onRecordBearish}
              className="flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-semibold text-[var(--fintheon-bearish)] bg-[var(--fintheon-bearish)]/10 hover:bg-[var(--fintheon-bearish)]/20 transition-colors"
              title="Record Bearish ORB Day"
            >
              <TrendingDown className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>

        {/* Mini chat separator + input */}
        <div className="h-px bg-[var(--fintheon-accent)]/5 my-2" />
        <RegimeMiniChat regime={regime} onExpandToSidebar={onExpandToSidebar} />
      </div>
    </GlassEffect>
  );
}
