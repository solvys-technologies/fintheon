// [claude-code 2026-04-10] S9-T2: Refactored to use AlertCardBase — tape variant
// [claude-code 2026-04-30] Dashboard tape now uses the same distilled RiskFlow
// post expansion as Strategium/full RiskFlow: media/source/chat actions only.
import { useState } from "react";
import { ChevronRight, Diff, TrendingDown } from "lucide-react";
import type { RiskFlowAlert, TradeIdeaDetail } from "../../lib/riskflow-feed";
import { AlertCardBase } from "../feed/AlertCardBase";
import { RiskFlowPostCard } from "../feed/RiskFlowPostCard";

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
}: ExpandableTapeItemProps) {
  const [expanded, setExpanded] = useState(false);
  const isTradeIdea = alert.source === "trade-idea" && !!alert.tradeIdea;

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
          {isTradeIdea ? (
            <div className="px-4 pb-3 border-t border-zinc-800/40">
              {/* Trade Idea detail */}
              {alert.tradeIdea && (
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
            </div>
          ) : (
            <RiskFlowPostCard alert={alert} surface="mini" />
          )}
          <div className="flex items-center justify-end border-t border-zinc-800/35 px-3 py-2">
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
        </>
      }
    />
  );
}
