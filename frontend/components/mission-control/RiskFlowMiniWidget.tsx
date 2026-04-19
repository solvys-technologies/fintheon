// [claude-code 2026-03-05] Phase 3B: RiskFlow mini widget for Mission Control deck
// [claude-code 2026-03-10] T3: critical severity dot (orange)
// [claude-code 2026-04-19] RiskFlow card polish: severity dot replaced with the shared
//   segmented vertical NothingFuse, time stamp now renders in Doto for consistency with
//   every other RiskFlow card surface.
import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Diff,
  TrendingDown,
  Zap,
} from "lucide-react";
import { useRiskFlow } from "../../contexts/RiskFlowContext";
import type { TradeIdeaDetail } from "../../lib/riskflow-feed";
import TradeIdeaModal from "../TradeIdeaModal";
import { timeAgo } from "../../lib/time-utils";
import { NothingFuse } from "../shared/NothingFuse";
import {
  alertSeverityToPalette,
  fuseScoreFromAlert,
} from "../../lib/riskflow-card-utils";

const VISIBLE_COUNT = 4;

export function RiskFlowMiniWidget() {
  const { alerts, isSeen, markSeen, freshAlertId } = useRiskFlow();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIdea, setSelectedIdea] = useState<TradeIdeaDetail | null>(
    null,
  );

  const unseenCount = alerts.filter((a) => !isSeen(a.id)).length;
  const visible = alerts.slice(0, VISIBLE_COUNT);
  const moreCount = Math.max(0, alerts.length - VISIBLE_COUNT);

  return (
    <>
      {selectedIdea && (
        <TradeIdeaModal
          idea={selectedIdea}
          onClose={() => setSelectedIdea(null)}
        />
      )}

      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-3.5 h-3.5 text-[var(--fintheon-accent)]" />
          <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-[var(--fintheon-accent)]">
            RiskFlow
          </span>
          {unseenCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500/30 text-red-400 text-[9px] font-bold">
              {unseenCount}
            </span>
          )}
        </div>

        {/* Compact alert rows */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5">
          {visible.length === 0 ? (
            <div className="text-[10px] text-zinc-600 py-2">No alerts</div>
          ) : (
            visible.map((alert) => {
              const isTradeIdea =
                alert.source === "trade-idea" && !!alert.tradeIdea;
              const isExpanded = expandedId === alert.id;
              const seen = isSeen(alert.id);
              const palSeverity = alertSeverityToPalette(alert.severity);
              const fuseScore = fuseScoreFromAlert(alert);

              return (
                <div
                  key={alert.id}
                  className={`rounded ${seen ? "opacity-60" : ""} ${alert.id === freshAlertId ? "riskflow-flicker" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      markSeen(alert.id);
                      setExpandedId(isExpanded ? null : alert.id);
                    }}
                    className="w-full flex items-stretch gap-2 px-2 py-1.5 text-left hover:bg-white/[0.02] transition-colors min-h-[26px]"
                  >
                    {/* Segmented vertical fuse — replaces the old severity dot */}
                    {isTradeIdea ? (
                      <span className="shrink-0 flex items-center w-2.5">
                        {alert.tradeIdea!.direction === "long" ? (
                          <Diff className="w-2.5 h-2.5 text-[var(--fintheon-accent)]" />
                        ) : (
                          <TrendingDown className="w-2.5 h-2.5 text-zinc-400" />
                        )}
                      </span>
                    ) : (
                      <div className="shrink-0 w-[3px] flex items-stretch py-0.5">
                        <NothingFuse
                          value={Math.min(1, Math.max(0.15, fuseScore / 10))}
                          severity={palSeverity}
                          orientation="vertical"
                          thickness={3}
                        />
                      </div>
                    )}
                    <span className="flex-1 min-w-0 text-[11px] text-zinc-300 truncate self-center">
                      {alert.headline}
                    </span>
                    <span
                      className="text-[10px] text-zinc-600 shrink-0 self-center"
                      style={{
                        fontFamily:
                          "'Doto', 'Readable Digits', var(--font-data, monospace)",
                        letterSpacing: "0.02em",
                      }}
                    >
                      {timeAgo(alert.publishedAt)}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-2.5 h-2.5 text-zinc-600 shrink-0 self-center" />
                    ) : (
                      <ChevronDown className="w-2.5 h-2.5 text-zinc-600 shrink-0 self-center" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="px-2 pb-2 border-t border-zinc-800/30">
                      {alert.summary && (
                        <p className="mt-1 text-[10px] text-zinc-500 leading-relaxed">
                          {alert.summary}
                        </p>
                      )}
                      {isTradeIdea && alert.tradeIdea && (
                        <button
                          type="button"
                          onClick={() => setSelectedIdea(alert.tradeIdea!)}
                          className="mt-1 text-[9px] text-[var(--fintheon-accent)] hover:text-[#dbb85c] transition-colors uppercase tracking-wider"
                        >
                          View Proposal →
                        </button>
                      )}
                      {!isTradeIdea && alert.url && (
                        <a
                          href={alert.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-[9px] text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                          <ExternalLink className="w-2 h-2" /> Source
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {moreCount > 0 && (
          <div className="mt-1 text-[9px] text-zinc-600 text-center">
            +{moreCount} more alert{moreCount !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </>
  );
}
