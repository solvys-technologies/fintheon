// [claude-code 2026-03-05] Expandable tape item for ExecutiveDashboard — shows full RiskFlow detail on click
// [claude-code 2026-03-11] Replace text source label with SVG icons (X/Notion)
// [claude-code 2026-03-27] S3: Plain text DetailFooter, expanded border-l-4 + ring highlight
// [claude-code 2026-03-26] T3: Smooth expand transitions, agent notes, risk type, sub-scores, beat/miss
import { useState, useCallback } from "react";
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ExternalLink,
  Diff,
  TrendingDown,
} from "lucide-react";
import { SEVERITY_CONFIG } from "../../lib/severity-config";
import { ivHeatColor } from "../../types/miroshark";
import type { RiskFlowAlert, TradeIdeaDetail } from "../../lib/riskflow-feed";
import { useBackend } from "../../lib/backend";
import { DetailFooter } from "../feed/DetailFooter";
import { SourceIcon } from "../../lib/shared-icons";
import { timeAgo } from "../../lib/time-utils";

/** Infer Bullish/Bearish from alert data or headline keywords */
function inferDirection(alert: RiskFlowAlert): "Bullish" | "Bearish" {
  if (alert.direction === "Bullish" || alert.direction === "Bearish")
    return alert.direction;
  if (alert.tradeIdea)
    return alert.tradeIdea.direction === "long" ? "Bullish" : "Bearish";
  const lower = (alert.headline + " " + (alert.summary ?? "")).toLowerCase();
  const bullish = [
    "surge",
    "rally",
    "rise",
    "gain",
    "jump",
    "soar",
    "bull",
    "record high",
    "beat",
    "above",
    "upgrade",
    "boom",
    "positive",
    "strong",
    "up ",
  ];
  const bearish = [
    "drop",
    "fall",
    "crash",
    "plunge",
    "decline",
    "sink",
    "bear",
    "miss",
    "below",
    "downgrade",
    "slump",
    "negative",
    "fear",
    "risk",
    "warn",
    "cut",
    "sell",
    "weak",
    "down ",
  ];
  let b = 0,
    s = 0;
  for (const kw of bullish) if (lower.includes(kw)) b++;
  for (const kw of bearish) if (lower.includes(kw)) s++;
  return b >= s ? "Bullish" : "Bearish";
}

interface ExpandableTapeItemProps {
  alert: RiskFlowAlert;
  isVivid: boolean;
  opacity: number;
  borderOpacity: number;
  seen: boolean;
  onOpenIdea: (idea: TradeIdeaDetail) => void;
  onNavigateToFeed?: () => void;
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
  const backend = useBackend();
  const isTradeIdea = alert.source === "notion-trade-idea" && !!alert.tradeIdea;
  const sev = SEVERITY_CONFIG[alert.severity];
  // T1 will add these fields
  const riskType = (alert as any).riskType as string | null | undefined;
  const subScores = (alert as any).subScores as
    | { eventWeight: number; momentum: number; vixContext: number }
    | null
    | undefined;
  const agentNote = (alert as any).agentNote as string | null | undefined;
  const econData = (alert as any).econData as
    | { beatMiss?: string | null; surprisePercent?: number | null }
    | null
    | undefined;

  const handleGenerateNote = useCallback(async () => {
    const rawId = alert.id.replace(/^backend-/, "");
    try {
      await backend.riskflow.generateNote(rawId);
    } catch (err) {
      console.warn("[ExpandableTapeItem] Generate note failed:", err);
    }
  }, [alert.id, backend]);

  return (
    <div
      className={`transition-all duration-300 ${expanded ? "border border-[var(--fintheon-accent)]/20 rounded" : "border border-[var(--fintheon-border)]/10 rounded"} ${
        expanded
          ? "bg-[#0b0b08]"
          : isTradeIdea
            ? "bg-[#0b0b08]"
            : isVivid
              ? "bg-[#0b0b08] border-l-[var(--fintheon-accent)]/40"
              : "bg-[#080806]"
      }`}
      style={
        expanded
          ? ({
              "--tw-ring-color":
                "color-mix(in srgb, var(--fintheon-accent) 20%, transparent)",
            } as React.CSSProperties)
          : isVivid || isTradeIdea
            ? undefined
            : {
                opacity,
                borderLeftColor: `color-mix(in srgb, var(--fintheon-accent) ${Math.round(borderOpacity * 100)}%, transparent)`,
              }
      }
    >
      {/* Collapsed row */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 px-3 py-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isTradeIdea ? (
              <span className="inline-flex items-center justify-center w-4 h-4 border border-[var(--fintheon-accent)]/40 bg-[var(--fintheon-accent)]/10 flex-shrink-0">
                {alert.tradeIdea!.direction === "long" ? (
                  <Diff className="w-2.5 h-2.5 text-[var(--fintheon-accent)]" />
                ) : (
                  <TrendingDown className="w-2.5 h-2.5 text-zinc-400" />
                )}
              </span>
            ) : (
              <>
                {alert.severity === "high" && (
                  <span className="text-[9px] tracking-[0.18em] uppercase text-red-400 font-semibold">
                    Breaking
                  </span>
                )}
                {alert.severity === "medium" && (
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider ${sev.bg} ${sev.text}`}
                  >
                    {sev.label}
                  </span>
                )}
              </>
            )}
            <span
              className={`text-xs font-semibold truncate ${isVivid || isTradeIdea ? "text-white" : "text-gray-400"}`}
            >
              {alert.headline}
            </span>
          </div>
          {!expanded && alert.summary && alert.summary !== alert.headline && (
            <div
              className={`mt-0.5 text-[11px] line-clamp-1 ${isVivid ? "text-gray-400" : "text-gray-500"}`}
            >
              {alert.summary}
            </div>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          {(() => {
            const dir = inferDirection(alert);
            return (
              <span
                className="text-[9px] font-semibold"
                style={{
                  color:
                    dir === "Bullish"
                      ? "var(--fintheon-bullish)"
                      : "var(--fintheon-bearish)",
                }}
              >
                {dir === "Bullish" ? "▲" : "▼"}
              </span>
            );
          })()}
          {(alert as any).ivScore != null && (
            <span
              className="text-[9px] font-mono font-bold tabular-nums"
              style={{ color: ivHeatColor(Number((alert as any).ivScore)) }}
            >
              IV {Number((alert as any).ivScore).toFixed(1)}
            </span>
          )}
          <span
            className={`text-[10px] ${isVivid ? "text-gray-500" : "text-gray-600"}`}
          >
            {timeAgo(alert.publishedAt)}
          </span>
          {expanded ? (
            <ChevronUp className="w-3 h-3 text-zinc-600" />
          ) : (
            <ChevronDown className="w-3 h-3 text-zinc-600" />
          )}
        </div>
      </button>

      {/* Expanded detail — smooth CSS grid transition */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
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
              <>
                <div className="mt-2 flex items-center gap-3">
                  <SourceIcon
                    source={alert.source}
                    className="w-3 h-3 text-zinc-500 flex-shrink-0"
                  />
                  {riskType && (
                    <span className="text-[9px] font-medium tracking-wider uppercase px-1.5 py-0.5 border border-zinc-700 text-zinc-400">
                      {riskType}
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
              </>
            )}

            {/* Agent Note — shared for both trade ideas and regular alerts */}
            {agentNote ? (
              <div className="mt-2 px-3 py-2 bg-zinc-900/60 border border-zinc-800/50 text-[11px] text-zinc-300 leading-relaxed">
                <span className="text-[9px] text-zinc-600 uppercase tracking-wider block mb-1">
                  Agent Note
                </span>
                {agentNote}
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

            {/* View in RiskFlow CTA */}
            {onNavigateToFeed && (
              <div className="mt-2 flex justify-end">
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
              </div>
            )}
          </div>

          {/* S3: Plain text detail footer — IV, deviation, beat/miss, sub-scores, speaker, regime */}
          <DetailFooter alert={alert} />
        </div>
      </div>
    </div>
  );
}
