// [claude-code 2026-04-10] S9-T2: Refactored to use AlertCardBase — tape variant
import { useState, useCallback } from "react";
import {
  ChevronRight,
  ExternalLink,
  Diff,
  TrendingDown,
  ThumbsDown,
} from "@/components/shared/iso-icons";
import type { RiskFlowAlert, TradeIdeaDetail } from "../../lib/riskflow-feed";
import { useBackend } from "../../lib/backend";
import { DetailFooter } from "../feed/DetailFooter";
import { AlertCardBase } from "../feed/AlertCardBase";
import { SourceIcon } from "../../lib/shared-icons";

interface ExpandableTapeItemProps {
  alert: RiskFlowAlert;
  isVivid: boolean;
  opacity: number;
  borderOpacity: number;
  seen: boolean;
  onOpenIdea: (idea: TradeIdeaDetail) => void;
  onNavigateToFeed?: () => void;
  onNotRelevant?: (id: string) => void;
}

export function ExpandableTapeItem({
  alert,
  isVivid,
  opacity,
  borderOpacity,
  seen,
  onOpenIdea,
  onNavigateToFeed,
  onNotRelevant,
}: ExpandableTapeItemProps) {
  const [expanded, setExpanded] = useState(false);
  const backend = useBackend();
  const isTradeIdea = alert.source === "trade-idea" && !!alert.tradeIdea;

  const handleGenerateNote = useCallback(async () => {
    const rawId = alert.id.replace(/^backend-/, "");
    try {
      await backend.riskflow.generateNote(rawId);
    } catch (err) {
      console.warn("[ExpandableTapeItem] Generate note failed:", err);
    }
  }, [alert.id, backend]);

  // Tape-specific outer container styling
  const tapeClassName = `transition-all duration-300 ${
    expanded
      ? "border border-[var(--fintheon-accent)]/20 rounded bg-[#0b0b08]"
      : isTradeIdea
        ? "border border-[var(--fintheon-border)]/10 rounded bg-[#0b0b08]"
        : isVivid
          ? "border border-[var(--fintheon-border)]/10 rounded bg-[#0b0b08] border-l-[var(--fintheon-accent)]/40"
          : "border border-[var(--fintheon-border)]/10 rounded bg-[#080806]"
  }`;

  const tapeStyle: React.CSSProperties = expanded
    ? ({
        "--tw-ring-color":
          "color-mix(in srgb, var(--fintheon-accent) 20%, transparent)",
      } as React.CSSProperties)
    : !(isVivid || isTradeIdea)
      ? {
          opacity,
          borderLeftColor: `color-mix(in srgb, var(--fintheon-accent) ${Math.round(borderOpacity * 100)}%, transparent)`,
        }
      : {};

  return (
    <AlertCardBase
      alert={alert}
      variant="tape"
      seen={seen}
      expanded={expanded}
      onToggle={() => setExpanded(!expanded)}
      className={tapeClassName}
      style={tapeStyle}
      headerActions={
        isTradeIdea ? (
          <span className="inline-flex items-center justify-center w-4 h-4 border border-[var(--fintheon-accent)]/40 bg-[var(--fintheon-accent)]/10 flex-shrink-0">
            {alert.tradeIdea!.direction === "long" ? (
              <Diff className="w-2.5 h-2.5 text-[var(--fintheon-accent)]" />
            ) : (
              <TrendingDown className="w-2.5 h-2.5 text-zinc-400" />
            )}
          </span>
        ) : undefined
      }
      expandedContent={
        <>
          <div className="px-4 pb-3 border-t border-zinc-800/40">
            {/* Summary */}
            {alert.summary && (
              <p className="mt-2 text-[11px] text-gray-400 leading-relaxed">
                {alert.summary}
              </p>
            )}

            {/* Trade Idea detail */}
            {isTradeIdea && alert.tradeIdea && (
              <div className="mt-2 space-y-2">
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  {alert.tradeIdea.entry != null && (
                    <div>
                      <span className="text-gray-600 uppercase tracking-wider">
                        Entry
                      </span>
                      <div className="mt-0.5 text-gray-300">
                        ${alert.tradeIdea.entry}
                      </div>
                    </div>
                  )}
                  {alert.tradeIdea.stopLoss != null && (
                    <div>
                      <span className="text-gray-600 uppercase tracking-wider">
                        Stop
                      </span>
                      <div
                        className="mt-0.5"
                        style={{
                          color:
                            "color-mix(in srgb, var(--fintheon-bearish) 80%, transparent)",
                        }}
                      >
                        ${alert.tradeIdea.stopLoss}
                      </div>
                    </div>
                  )}
                  {alert.tradeIdea.takeProfit != null && (
                    <div>
                      <span className="text-gray-600 uppercase tracking-wider">
                        Target
                      </span>
                      <div
                        className="mt-0.5"
                        style={{
                          color:
                            "color-mix(in srgb, var(--fintheon-bullish) 80%, transparent)",
                        }}
                      >
                        ${alert.tradeIdea.takeProfit}
                      </div>
                    </div>
                  )}
                </div>
                {alert.tradeIdea.riskRewardRatio != null && (
                  <div className="text-[10px] text-zinc-500">
                    R/R {alert.tradeIdea.riskRewardRatio.toFixed(1)}:1
                    {alert.tradeIdea.confidence &&
                      ` · ${alert.tradeIdea.confidence}% confidence`}
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenIdea(alert.tradeIdea!);
                  }}
                  className="mt-1 text-[10px] text-[var(--fintheon-accent)] hover:text-[#dbb85c] transition-colors uppercase tracking-wider"
                >
                  View Full Proposal →
                </button>
              </div>
            )}

            {/* Regular alert detail */}
            {!isTradeIdea && (
              <div className="mt-2 flex items-center gap-3">
                <SourceIcon
                  source={alert.source}
                  className="w-3 h-3 text-zinc-500 flex-shrink-0"
                />
                {alert.riskType && (
                  <span className="text-[9px] font-medium tracking-wider uppercase px-1.5 py-0.5 border border-zinc-700 text-zinc-400">
                    {alert.riskType}
                  </span>
                )}
                {alert.tags.length > 0 && (
                  <div className="flex gap-1">
                    {alert.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800/50 text-zinc-500"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {alert.url && (
                  <a
                    href={alert.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
                  >
                    <ExternalLink className="w-2.5 h-2.5" />
                    Source
                  </a>
                )}
              </div>
            )}

            {/* Agent Note — shared for both trade ideas and regular alerts */}
            {alert.agentNote ? (
              <div className="mt-2 px-3 py-2 bg-zinc-900/60 border border-zinc-800/50 text-[11px] text-zinc-300 leading-relaxed">
                <span className="text-[9px] text-zinc-600 uppercase tracking-wider block mb-1">
                  Agent Note
                </span>
                {alert.agentNote}
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleGenerateNote();
                }}
                className="mt-2 flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors"
              >
                Generate Note +
              </button>
            )}

            {/* Footer actions — thumbs down + View in RiskFlow */}
            <div className="mt-2 flex items-center justify-end gap-1">
              {onNotRelevant && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNotRelevant(alert.id);
                  }}
                  title="Not relevant — remove and flag"
                  className="p-0.5 rounded text-zinc-600 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100"
                  style={{
                    transition:
                      "opacity 1.2s ease, color 0.2s ease, background-color 0.2s ease",
                  }}
                >
                  <ThumbsDown className="w-2.5 h-2.5" />
                </button>
              )}
              {onNavigateToFeed && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigateToFeed();
                  }}
                  className="text-[10px] text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors flex items-center gap-1"
                >
                  View in RiskFlow
                  <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* S3: Plain text detail footer — IV, deviation, beat/miss, sub-scores, speaker, regime */}
          <DetailFooter alert={alert} />
        </>
      }
    />
  );
}
