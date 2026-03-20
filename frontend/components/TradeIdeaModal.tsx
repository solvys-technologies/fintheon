// [claude-code 2026-03-13] Hermes migration: openclawDescription -> hermesDescription
// [claude-code 2026-03-03] Trade Idea modal — shown when a Notion trade idea RiskFlow item is clicked.
// [claude-code 2026-03-03] Layout polish: tighter padding, formatted price values.
// Solvys Gold palette: BG #050402, Accent #c79f4a, Text #f0ead6. No gradients, no colored emojis.

import React from 'react';
import { X, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';
import type { TradeIdeaDetail } from '../lib/riskflow-feed';

function formatPrice(n: number): string {
  if (n <= 1) return `$${n.toFixed(2)}`;
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

interface TradeIdeaModalProps {
  idea: TradeIdeaDetail;
  onClose: () => void;
}

function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[#0a0a06] border border-[var(--fintheon-accent)]/20 px-2.5 py-2">
      <div className="text-[9px] tracking-[0.22em] uppercase text-[var(--fintheon-accent)]/60 mb-0.5">{label}</div>
      <div className="text-xs font-semibold text-[var(--fintheon-text)]">{value}</div>
      {sub && <div className="text-[10px] text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function TradeIdeaModal({ idea, onClose }: TradeIdeaModalProps) {
  const isLong = idea.direction === 'long';
  const isShort = idea.direction === 'short';

  const confidenceColor =
    idea.confidence === 'high' ? 'text-[var(--fintheon-accent)]' :
    idea.confidence === 'medium' ? 'text-zinc-400' :
    'text-zinc-600';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal card */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-lg bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/40 shadow-[0_0_40px_rgba(199,159,74,0.15)] flex flex-col max-h-[85vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-4 py-3 border-b border-[var(--fintheon-accent)]/20 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`flex-shrink-0 p-1.5 border ${
                isLong ? 'border-[var(--fintheon-accent)]/40 text-[var(--fintheon-accent)]' :
                isShort ? 'border-zinc-600/40 text-zinc-400' :
                'border-zinc-700/40 text-zinc-600'
              }`}>
                {isShort ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold tracking-[0.2em] uppercase ${
                    isLong ? 'text-[var(--fintheon-accent)]' : isShort ? 'text-zinc-400' : 'text-zinc-600'
                  }`}>
                    {idea.direction.toUpperCase()}
                  </span>
                  {idea.confidence && (
                    <span className={`text-[9px] tracking-wider uppercase ${confidenceColor}`}>
                      {idea.confidence} confidence
                    </span>
                  )}
                </div>
                <div className="text-sm font-semibold text-[var(--fintheon-text)] truncate mt-0.5">
                  {idea.title}
                </div>
                {idea.sourceAgent && (
                  <div className="text-[10px] text-zinc-600 mt-0.5">
                    Proposed by {idea.sourceAgent}
                    {idea.timeframe ? ` · ${idea.timeframe}` : ''}
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
          <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-3.5">
            {/* Hermes description */}
            {idea.hermesDescription && (
              <div className="border-l-2 border-[var(--fintheon-accent)]/50 pl-3">
                <div className="text-[9px] tracking-[0.2em] uppercase text-[var(--fintheon-accent)]/60 mb-1.5">
                  Trade Brief
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {idea.hermesDescription}
                </p>
              </div>
            )}

            {/* Price levels grid */}
            {(idea.entry || idea.stopLoss || idea.takeProfit) && (
              <div>
                <div className="text-[9px] tracking-[0.2em] uppercase text-zinc-600 mb-2">Price Levels</div>
                <div className="grid grid-cols-3 gap-2">
                  {idea.entry != null && (
                    <StatBox label="Entry" value={formatPrice(idea.entry)} />
                  )}
                  {idea.stopLoss != null && (
                    <StatBox label="Stop Loss" value={formatPrice(idea.stopLoss)} />
                  )}
                  {idea.takeProfit != null && (
                    <StatBox label="Target / Exit" value={formatPrice(idea.takeProfit)} />
                  )}
                </div>
              </div>
            )}

            {/* Risk / Reward metrics */}
            {(idea.potentialRisk != null || idea.potentialProfit != null || idea.riskRewardRatio != null) && (
              <div>
                <div className="text-[9px] tracking-[0.2em] uppercase text-zinc-600 mb-2">Risk / Reward</div>
                <div className="grid grid-cols-3 gap-2">
                  {idea.potentialRisk != null && (
                    <StatBox
                      label="Potential Risk"
                      value={`${idea.potentialRisk.toFixed(1)}%`}
                      sub="of position"
                    />
                  )}
                  {idea.potentialProfit != null && (
                    <StatBox
                      label="Potential Profit"
                      value={`${idea.potentialProfit.toFixed(1)}%`}
                      sub="of position"
                    />
                  )}
                  {idea.riskRewardRatio != null && (
                    <StatBox
                      label="R/R Ratio"
                      value={`${idea.riskRewardRatio.toFixed(1)}:1`}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-t border-zinc-800/60">
            <span className="text-[10px] text-zinc-700 tracking-wider uppercase">Notion Trade Ideas</span>
            {idea.notionUrl && (
              <a
                href={idea.notionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] text-[var(--fintheon-accent)]/60 hover:text-[var(--fintheon-accent)] transition-colors"
              >
                View in Notion
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
