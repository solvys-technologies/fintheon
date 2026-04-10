// [claude-code 2026-03-03] Trade Idea modal — shown when a Notion trade idea RiskFlow item is clicked.
// [claude-code 2026-03-24] Enhanced with expected print analysis, consensus/contrarian trade views, act/pass recommendation

import React from "react";
import {
  X,
  Diff,
  TrendingDown,
  ArrowRightLeft,
  Target,
  Shield,
  AlertTriangle,
} from "lucide-react";
import type { TradeIdeaDetail } from "../lib/riskflow-feed";

function formatPrice(n: number): string {
  if (n <= 1) return `$${n.toFixed(2)}`;
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

interface TradeIdeaModalProps {
  idea: TradeIdeaDetail;
  onClose: () => void;
}

function StatBox({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`bg-[#0a0a06] border px-2.5 py-2 ${accent ? "border-[var(--fintheon-accent)]/40" : "border-[var(--fintheon-accent)]/20"}`}
    >
      <div className="text-[9px] tracking-[0.22em] uppercase text-[var(--fintheon-accent)]/60 mb-0.5">
        {label}
      </div>
      <div
        className={`text-xs font-semibold ${accent ? "text-[var(--fintheon-accent)]" : "text-[var(--fintheon-text)]"}`}
      >
        {value}
      </div>
      {sub && <div className="text-[10px] text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function TradeIdeaModal({ idea, onClose }: TradeIdeaModalProps) {
  const isLong = idea.direction === "long";
  const isShort = idea.direction === "short";

  const confidenceColor =
    idea.confidence === "high"
      ? "text-[var(--fintheon-accent)]"
      : idea.confidence === "medium"
        ? "text-zinc-400"
        : "text-zinc-600";

  // Derive expected print context from hermesDescription or title
  const hasExpectedPrint = idea.hermesDescription?.match(
    /expect|forecast|consensus|print|release/i,
  );

  // Determine recommendation based on confidence + R/R
  const shouldAct =
    idea.confidence === "high" &&
    (idea.riskRewardRatio == null || idea.riskRewardRatio >= 1.5);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm animate-[fadeIn_150ms_ease-out]"
        onClick={onClose}
      />

      {/* Modal card */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-lg bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/40 shadow-[0_0_40px_rgba(199,159,74,0.15)] flex flex-col max-h-[85vh] animate-[slideUp_200ms_ease-out]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-4 py-3 border-b border-[var(--fintheon-accent)]/20 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`flex-shrink-0 p-1.5 border ${
                  isLong
                    ? "border-[var(--fintheon-accent)]/40 text-[var(--fintheon-accent)]"
                    : isShort
                      ? "border-zinc-600/40 text-zinc-400"
                      : "border-zinc-700/40 text-zinc-600"
                }`}
              >
                {isShort ? (
                  <TrendingDown className="w-4 h-4" />
                ) : (
                  <Diff className="w-4 h-4" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold tracking-[0.2em] uppercase ${
                      isLong
                        ? "text-[var(--fintheon-accent)]"
                        : isShort
                          ? "text-zinc-400"
                          : "text-zinc-600"
                    }`}
                  >
                    {idea.direction.toUpperCase()}
                  </span>
                  {idea.ticker && (
                    <span className="text-[10px] font-mono font-bold text-[var(--fintheon-text)]/80 bg-[var(--fintheon-accent)]/10 px-1.5 py-0.5 rounded">
                      {idea.ticker}
                    </span>
                  )}
                  {idea.confidence && (
                    <span
                      className={`text-[9px] tracking-wider uppercase ${confidenceColor}`}
                    >
                      {idea.confidence} conf.
                    </span>
                  )}
                </div>
                <div className="text-sm font-semibold text-[var(--fintheon-text)] truncate mt-0.5">
                  {idea.title}
                </div>
                {idea.sourceAgent && (
                  <div className="text-[10px] text-zinc-600 mt-0.5">
                    Proposed by {idea.sourceAgent}
                    {idea.timeframe ? ` · ${idea.timeframe}` : ""}
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex-shrink-0 p-1.5 text-zinc-500 hover:text-[var(--fintheon-text)] hover:bg-zinc-800/50 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-4">
            {/* Trade Brief */}
            {idea.hermesDescription && (
              <div className="border border-[var(--fintheon-accent)]/10 rounded pl-3">
                <div className="text-[9px] tracking-[0.2em] uppercase text-[var(--fintheon-accent)]/60 mb-1.5">
                  Trade Brief
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {idea.hermesDescription}
                </p>
              </div>
            )}

            {/* Price Levels — Entry / Stop / Target */}
            {(idea.entry || idea.stopLoss || idea.takeProfit) && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-3 h-3 text-[var(--fintheon-accent)]/50" />
                  <span className="text-[9px] tracking-[0.2em] uppercase text-zinc-600">
                    Price Levels
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {idea.entry != null && (
                    <StatBox
                      label="Entry"
                      value={formatPrice(idea.entry)}
                      accent
                    />
                  )}
                  {idea.stopLoss != null && (
                    <StatBox
                      label="Stop Loss"
                      value={formatPrice(idea.stopLoss)}
                      sub={
                        idea.entry != null
                          ? `${Math.abs(idea.entry - idea.stopLoss).toFixed(1)} pts risk`
                          : undefined
                      }
                    />
                  )}
                  {idea.takeProfit != null && (
                    <StatBox
                      label="Profit Target"
                      value={formatPrice(idea.takeProfit)}
                      sub={
                        idea.entry != null
                          ? `${Math.abs(idea.takeProfit - idea.entry).toFixed(1)} pts reward`
                          : undefined
                      }
                    />
                  )}
                </div>
              </div>
            )}

            {/* Risk / Reward metrics */}
            {(idea.potentialRisk != null ||
              idea.potentialProfit != null ||
              idea.riskRewardRatio != null) && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-3 h-3 text-[var(--fintheon-accent)]/50" />
                  <span className="text-[9px] tracking-[0.2em] uppercase text-zinc-600">
                    Risk / Reward
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {idea.potentialRisk != null && (
                    <StatBox
                      label="Risk"
                      value={`${idea.potentialRisk.toFixed(1)}%`}
                      sub="of position"
                    />
                  )}
                  {idea.potentialProfit != null && (
                    <StatBox
                      label="Profit"
                      value={`${idea.potentialProfit.toFixed(1)}%`}
                      sub="of position"
                    />
                  )}
                  {idea.riskRewardRatio != null && (
                    <StatBox
                      label="R/R Ratio"
                      value={`${idea.riskRewardRatio.toFixed(1)}:1`}
                      accent={idea.riskRewardRatio >= 2}
                    />
                  )}
                </div>
              </div>
            )}

            {/* ── Consensus vs Contrarian Trade ── */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ArrowRightLeft className="w-3 h-3 text-[var(--fintheon-accent)]/50" />
                <span className="text-[9px] tracking-[0.2em] uppercase text-zinc-600">
                  Trade Scenarios
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {/* Consensus trade */}
                <div className="rounded border border-[var(--fintheon-accent)]/20 bg-[#0a0a06] p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${isLong ? "bg-[var(--fintheon-low)]" : "bg-[var(--fintheon-severe)]"}`}
                    />
                    <span className="text-[8px] font-mono font-bold text-[var(--fintheon-text)]/60 uppercase tracking-wider">
                      Consensus
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-relaxed">
                    {hasExpectedPrint
                      ? `If print meets expectations → ${isLong ? "go long" : "go short"} ${idea.ticker || "instrument"} at entry.`
                      : `${isLong ? "Long" : "Short"} ${idea.ticker || "instrument"} — aligned with current proposal direction.`}
                  </p>
                  {idea.entry != null && (
                    <div className="mt-1.5 text-[9px] font-mono text-[var(--fintheon-accent)]/70">
                      Entry {formatPrice(idea.entry)} → Target{" "}
                      {idea.takeProfit != null
                        ? formatPrice(idea.takeProfit)
                        : "TBD"}
                    </div>
                  )}
                </div>

                {/* Contrarian trade */}
                <div className="rounded border border-violet-500/20 bg-[#0a0a06] p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${isLong ? "bg-[var(--fintheon-severe)]" : "bg-[var(--fintheon-low)]"}`}
                    />
                    <span className="text-[8px] font-mono font-bold text-violet-400/80 uppercase tracking-wider">
                      Contrarian
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-relaxed">
                    {hasExpectedPrint
                      ? `If print misses expectations → fade the move. ${isLong ? "Short" : "Long"} ${idea.ticker || "instrument"} on reversal.`
                      : `${isLong ? "Short" : "Long"} ${idea.ticker || "instrument"} — fade the consensus direction.`}
                  </p>
                  {idea.stopLoss != null && idea.entry != null && (
                    <div className="mt-1.5 text-[9px] font-mono text-violet-400/70">
                      Entry near {formatPrice(idea.stopLoss)} → Target{" "}
                      {formatPrice(idea.entry)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Act / Pass Recommendation ── */}
            <div
              className={`rounded border p-3 ${
                shouldAct
                  ? "border-[var(--fintheon-accent)]/30 bg-[var(--fintheon-accent)]/5"
                  : "border-zinc-700/30 bg-zinc-900/30"
              }`}
            >
              <div className="flex items-center gap-2">
                {shouldAct ? (
                  <Target className="w-3.5 h-3.5 text-[var(--fintheon-accent)]" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-zinc-500" />
                )}
                <span
                  className={`text-[10px] font-bold tracking-[0.15em] uppercase ${
                    shouldAct
                      ? "text-[var(--fintheon-accent)]"
                      : "text-zinc-500"
                  }`}
                >
                  {shouldAct
                    ? "Actionable — Execute Trade"
                    : "Review — Discretionary"}
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 mt-1.5 leading-relaxed">
                {shouldAct
                  ? `High-confidence setup with ${idea.riskRewardRatio != null ? `${idea.riskRewardRatio.toFixed(1)}:1 R/R` : "favorable risk/reward"}. PIC analysis supports execution on the consensus trade. Monitor for contrarian entry if print surprises.`
                  : `${idea.confidence ?? "Unknown"} confidence — requires discretionary judgment. Review expected print data before committing capital. Consider sizing down or waiting for confirmation.`}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-t border-zinc-800/60">
            <span className="text-[10px] text-zinc-700 tracking-wider uppercase">
              PIC Trade Proposals
            </span>
            <div className="flex items-center gap-2">
              {idea.confidence && (
                <span
                  className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    idea.confidence === "high"
                      ? "bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)]"
                      : "bg-zinc-800 text-zinc-500"
                  }`}
                >
                  {idea.confidence.toUpperCase()}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </>
  );
}
