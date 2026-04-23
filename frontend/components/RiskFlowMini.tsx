// [claude-code 2026-03-03] Add trade idea row rendering (gold border, click-to-modal).
// [claude-code 2026-03-10] Status dots (X CLI), dropdown filters (Priority + Source), X filter.
// [claude-code 2026-03-10] T3: critical severity renders same as high (pulse + red text)
// [claude-code 2026-03-11] v7.7.7 T3: Card overhaul — SVG logos, cyclical badge top-right,
//   point range, approve/deny CTA on proposals, chat CTA on news, remove "Neutral" text.
// [claude-code 2026-03-11] T5: drag-drop support for chat injection (application/x-riskflow)
// [claude-code 2026-03-16] T2: AlertRow bottom-hero redesign, toolbar consolidation, shared inferDirection
// [claude-code 2026-03-20] S3:T4d: Swapped chevron directions — expanded=ChevronDown, collapsed=ChevronUp
// [claude-code 2026-03-26] T3: Card expand/collapse with agent notes, risk type tags, smooth transitions
// [claude-code 2026-03-28] S8-T6: Infinite scroll + toggle, Loader2 for loading state
// [claude-code 2026-04-19] RiskFlow card polish: AlertRow + TradeIdeaRow now use the shared
//   IVStack (Doto numerals, chevron stacked above) on the right edge, and a single segmented
//   NothingFuse on the left. Killed the AlertRow double-border bug (2px borderLeft was
//   layered on top of the 6px NothingFuse) and dropped the bottom hero footer's IV/chevron
//   pair so the right column owns IV display.
import React, { useState, useCallback, useRef, useEffect } from "react";
import { useRiskFlow } from "../contexts/RiskFlowContext";
import { useToast } from "../contexts/ToastContext";
import {
  Zap,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Diff,
  TrendingDown,
  MessageSquare,
  Check,
  XCircle,
  RefreshCw,
  Loader2,
  ThumbsDown,
} from "lucide-react";
import type { RiskFlowAlert, TradeIdeaDetail } from "../lib/riskflow-feed";
import { inferDirection } from "../lib/riskflow-feed";
import TradeIdeaModal from "./TradeIdeaModal";
import { useSourceStatus } from "../hooks/useSourceStatus";
import {
  useRiskFlowFilters,
  type SeverityFilter,
} from "../hooks/useRiskFlowFilters";
import { SourceFilterMenu } from "./feed/SourceFilterMenu";
import { useBackend } from "../lib/backend";

import { SEVERITY_CONFIG } from "../lib/severity-config";
import { ivHeatColor } from "../types/agent-desk";
import { SourceIcon } from "../lib/shared-icons";
import { NothingFuse } from "./shared/NothingFuse";
import { IVStack } from "./shared/IVStack";
import { PriorityFilterMenu } from "./shared/PriorityFilterMenu";
import {
  alertSeverityToPalette,
  fuseScoreFromAlert,
} from "../lib/riskflow-card-utils";
import { severityFromScore } from "../lib/fuse-palette";
import type { AlertSeverity } from "../lib/riskflow-feed";

// ── Cyclical Badge ───────────────────────────────────────────────────────────

function CyclicalBadge({ classification }: { classification: string }) {
  if (classification === "Neutral") return null;
  const isCyclical = classification === "Cyclical";
  return (
    <span
      className={`text-[8px] font-bold tracking-[0.15em] uppercase px-1 py-px border ${
        isCyclical
          ? "border-[var(--fintheon-accent)]/30 text-[var(--fintheon-accent)]/80 bg-[var(--fintheon-accent)]/5"
          : "border-violet-500/30 text-violet-400/80 bg-violet-500/5"
      }`}
    >
      {isCyclical ? "CYC" : "CTR"}
    </span>
  );
}

// ── Direction Badge (used in TradeIdeaRow) ───────────────────────────────────

function DirectionBadge({ alert }: { alert: RiskFlowAlert }) {
  const dir = inferDirection(alert);
  const isBull = dir === "Bullish";
  return (
    <span
      className="text-[9px] font-semibold"
      style={{
        color: isBull ? "var(--fintheon-bullish)" : "var(--fintheon-bearish)",
      }}
    >
      {"±"}
    </span>
  );
}

function IVScoreBadge({ alert }: { alert: RiskFlowAlert }) {
  const score = alert.ivScore;
  if (score == null) return null;
  return (
    <span
      className="text-[9px] font-mono font-bold tabular-nums"
      style={{ color: ivHeatColor(Number(score)) }}
    >
      IV {Number(score).toFixed(1)}
    </span>
  );
}

// ── Risk Type Badge ──────────────────────────────────────────────────────────

function RiskTypeBadge({ riskType }: { riskType: string }) {
  return (
    <span className="text-[9px] font-medium tracking-wider uppercase px-1.5 py-0.5 border border-zinc-700 text-zinc-400">
      {riskType}
    </span>
  );
}

// ── Agent Note Section ──────────────────────────────────────────────────────

function AgentNoteSection({
  alert,
  onGenerate,
}: {
  alert: RiskFlowAlert;
  onGenerate: (alertId: string) => void;
}) {
  // T1 will add these fields
  const agentNote = (alert as any).agentNote as string | null | undefined;

  if (agentNote) {
    return (
      <div className="mt-2 px-3 py-2 bg-zinc-900/60 border border-zinc-800/50 text-[11px] text-zinc-300 leading-relaxed">
        <span className="text-[9px] text-zinc-600 uppercase tracking-wider block mb-1">
          Agent Note
        </span>
        {agentNote}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onGenerate(alert.id);
      }}
      className="mt-2 flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors"
    >
      Generate Note +
    </button>
  );
}

import { timeAgo } from "../lib/time-utils";

// ── Trade Idea Row (proposals — with approve/deny CTA) ──────────────────────

function TradeIdeaRow({
  alert,
  onDelete,
  onOpen,
  onMarkSeen,
  onApprove,
  onDeny,
  seen,
  expanded,
  fresh,
  onToggleExpand,
  onGenerateNote,
}: {
  alert: RiskFlowAlert;
  onDelete: (id: string) => void;
  onOpen: (idea: TradeIdeaDetail) => void;
  onMarkSeen: (id: string) => void;
  onApprove?: (alert: RiskFlowAlert) => void;
  onDeny?: (alert: RiskFlowAlert) => void;
  seen: boolean;
  expanded: boolean;
  fresh?: boolean;
  onToggleExpand: () => void;
  onGenerateNote: (alertId: string) => void;
}) {
  const idea = alert.tradeIdea!;
  const isLong = idea.direction === "long";
  const isShort = idea.direction === "short";
  // T1 will add these fields
  const riskType = (alert as any).riskType as string | null | undefined;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(
      "application/x-riskflow",
      JSON.stringify({
        headline: alert.headline,
        summary: alert.summary,
        ticker: idea.ticker,
        direction: idea.direction,
      }),
    );
    e.dataTransfer.effectAllowed = "copy";
  };

  // [claude-code 2026-04-19] Polish pass: single segmented vertical fuse + right IVStack.
  //   Bottom-border accent is gone — fuse + right column own all the priority signaling.
  const tradeIdeaPalSeverity = alertSeverityToPalette(alert.severity);
  const tradeIdeaFuseScore = fuseScoreFromAlert(alert);
  const tradeIdeaDir = inferDirection(alert);
  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={`group relative border-b border-zinc-800/50 hover:bg-[var(--fintheon-accent)]/5 transition-colors ${
        seen ? "opacity-70" : ""
      } ${fresh ? "riskflow-flicker" : ""}`}
    >
      <div
        className="flex items-stretch gap-3 px-3 py-3 cursor-pointer min-h-[64px]"
        onClick={() => {
          onMarkSeen(alert.id);
          onOpen(idea);
        }}
      >
        {/* Left: segmented vertical fuse */}
        <div className="flex-shrink-0 w-[6px] flex items-stretch py-0.5">
          <NothingFuse
            value={Math.min(1, Math.max(0.15, tradeIdeaFuseScore / 10))}
            severity={tradeIdeaPalSeverity}
            orientation="vertical"
            thickness={6}
          />
        </div>

        {/* Cyclical badge — top right */}
        {alert.cyclical && alert.cyclical !== "Neutral" && (
          <div className="absolute top-1.5 right-9">
            <CyclicalBadge classification={alert.cyclical} />
          </div>
        )}

        <div className="flex-1 min-w-0 flex items-start gap-2">
          {/* Direction icon badge */}
          <span className="flex-shrink-0 mt-0.5 inline-flex items-center justify-center w-5 h-5 border border-[var(--fintheon-accent)]/40 bg-[var(--fintheon-accent)]/10">
            {isLong ? (
              <Diff className="w-3 h-3 text-[var(--fintheon-accent)]" />
            ) : isShort ? (
              <TrendingDown className="w-3 h-3 text-zinc-400" />
            ) : (
              <Diff className="w-3 h-3 text-[var(--fintheon-accent)]" />
            )}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[9px] tracking-[0.08em] uppercase text-zinc-500 mb-0.5">
              <SourceIcon
                source={alert.source}
                className="w-2.5 h-2.5 text-zinc-500"
              />
              <span>{timeAgo(alert.publishedAt)}</span>
              <span className="text-zinc-700">&middot;</span>
              <span className="text-[var(--fintheon-accent)]/60">
                {idea.sourceAgent ?? "Proposal"}
              </span>
              {idea.riskRewardRatio && (
                <>
                  <span className="text-zinc-700">&middot;</span>
                  <span className="text-zinc-500 normal-case tracking-normal">
                    R/R {idea.riskRewardRatio.toFixed(1)}:1
                  </span>
                </>
              )}
            </div>
            <p className="text-xs leading-snug font-medium line-clamp-2 text-[var(--fintheon-text)] group-hover:text-white transition-colors">
              {alert.headline}
            </p>
            {alert.summary && alert.summary !== alert.headline && (
              <p className="text-[10px] text-zinc-600 line-clamp-1 mt-0.5">
                {alert.summary}
              </p>
            )}
          </div>
        </div>

        {/* Right: chevron + IV in Doto, stacked */}
        <IVStack
          score={alert.ivScore != null ? Number(alert.ivScore) : null}
          direction={
            tradeIdeaDir === "Bullish"
              ? "Bullish"
              : tradeIdeaDir === "Bearish"
                ? "Bearish"
                : "Neutral"
          }
          width={36}
        />

        {/* Expand chevron + Approve / Deny CTA */}
        <div className="flex-shrink-0 flex items-center gap-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="p-1 rounded text-zinc-600 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors"
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronUp className="w-3 h-3" />
            )}
          </button>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onApprove?.(alert);
              }}
              className="p-1 rounded text-emerald-600 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
              title="Approve proposal"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeny?.(alert);
              }}
              className="p-1 rounded text-red-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Deny proposal"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded content — smooth CSS grid transition */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="px-3 py-2.5 border-t border-zinc-800/40 bg-zinc-900/40">
            <AgentNoteSection alert={alert} onGenerate={onGenerateNote} />
            {riskType && (
              <div className="flex items-center gap-1.5 mt-2">
                <RiskTypeBadge riskType={riskType} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Alert Row (news — square edge-to-edge card with bottom-hero footer) ──────

function AlertRow({
  alert,
  onMarkSeen,
  onChat,
  seen,
  expanded,
  fresh,
  onToggleExpand,
  onGenerateNote,
  onNavigateToFeed,
  onNotRelevant,
}: {
  alert: RiskFlowAlert;
  onMarkSeen: (id: string) => void;
  onChat?: (alert: RiskFlowAlert) => void;
  seen: boolean;
  expanded: boolean;
  fresh?: boolean;
  onToggleExpand: () => void;
  onGenerateNote: (alertId: string) => void;
  onNavigateToFeed?: () => void;
  onNotRelevant?: (id: string) => void;
}) {
  const sev = SEVERITY_CONFIG[alert.severity];
  const isHigh = alert.severity === "high" || alert.severity === "critical";
  const dir = inferDirection(alert);
  const isBull = dir === "Bullish";
  // T1 will add these fields
  const riskType = (alert as any).riskType as string | null | undefined;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(
      "application/x-riskflow",
      JSON.stringify({
        headline: alert.headline,
        summary: alert.summary,
      }),
    );
    e.dataTransfer.effectAllowed = "copy";
  };

  // [claude-code 2026-04-19] Polish pass: kill the double-border bug — was 2px borderLeft
  //   stacked over the 6px NothingFuse — and move IV/direction into the right IVStack.
  //   Mirrors the Fintheon Mobile RiskFlow card anatomy.
  const palSeverity = alertSeverityToPalette(alert.severity);
  const fuseScore = fuseScoreFromAlert(alert);
  const directionForStack: "Bullish" | "Bearish" | "Neutral" =
    dir === "Bullish" ? "Bullish" : dir === "Bearish" ? "Bearish" : "Neutral";

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={`group relative border-b border-zinc-800/60 overflow-hidden hover:border-[var(--fintheon-accent)]/30 transition-colors ${isHigh ? "riskflow-fintheon-row" : ""} ${seen ? "opacity-70" : ""} ${fresh ? "riskflow-flicker" : ""}`}
    >
      {/* Main content area */}
      <div
        className="block px-3 pt-3 pb-2.5 cursor-pointer"
        onClick={() => {
          onMarkSeen(alert.id);
          onToggleExpand();
        }}
      >
        <div className="flex items-stretch gap-3 min-h-[72px]">
          {/* Left: segmented vertical severity fuse */}
          <div className="flex-shrink-0 w-[6px] flex items-stretch py-0.5">
            <NothingFuse
              value={Math.min(1, Math.max(0.15, fuseScore / 10))}
              severity={severityFromScore(fuseScore)}
              orientation="vertical"
              thickness={6}
            />
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
            {/* Source / time row */}
            <div className="flex items-center gap-1.5 text-[9px] tracking-[0.08em] uppercase text-zinc-500">
              <span className="truncate max-w-[60%]">{alert.source}</span>
              <span className="text-zinc-700">&middot;</span>
              <span>{timeAgo(alert.publishedAt)}</span>
            </div>
            <p
              className={`text-xs leading-snug font-medium line-clamp-3 break-words ${alert.severity === "critical" ? "text-orange-300" : isHigh ? "text-red-300" : "text-zinc-300"} group-hover:text-white transition-colors`}
            >
              {alert.headline}
            </p>
            {alert.summary && alert.summary !== alert.headline && (
              <p className="text-[10px] text-zinc-600 line-clamp-1 mt-0.5">
                {alert.summary}
              </p>
            )}
            {/* Cyclical badge + risk type + author row */}
            {(alert.cyclical || riskType || alert.authorHandle) && (
              <div className="flex items-center gap-1.5 mt-1">
                {alert.cyclical && alert.cyclical !== "Neutral" && (
                  <CyclicalBadge classification={alert.cyclical} />
                )}
                {riskType && <RiskTypeBadge riskType={riskType} />}
                {alert.authorHandle && (
                  <span className="text-[9px] text-zinc-500">
                    @{alert.authorHandle}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right: chevron + IV in Doto, stacked */}
          <IVStack
            score={alert.ivScore != null ? Number(alert.ivScore) : null}
            direction={directionForStack}
            color={
              alert.ivScore != null
                ? ivHeatColor(Number(alert.ivScore))
                : undefined
            }
            width={36}
          />

          {/* Chat CTA */}
          <div className="flex-shrink-0 flex items-start">
            {onChat && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChat(alert);
                }}
                className="p-1 rounded text-zinc-600 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors opacity-0 group-hover:opacity-100"
                title="Chat about this"
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Compact footer strip — priority badge + dismiss only (no IV/dir duplication) */}
        <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-zinc-800/30">
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded-[2px] text-[9px] font-bold tracking-wider ${sev.bg} ${sev.text} ${sev.border} border ${sev.glow || ""} h-[16px]`}
          >
            {sev.label}
          </span>
          <span className="flex-1" />
          <span className="text-[9px] text-zinc-600">
            {expanded ? "Less" : "More"}
          </span>
          {expanded ? (
            <ChevronDown className="w-3 h-3 text-zinc-600" />
          ) : (
            <ChevronUp className="w-3 h-3 text-zinc-600" />
          )}
        </div>
      </div>

      {/* Expanded content — smooth CSS grid transition */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="px-3 py-2.5 border-t border-zinc-800/40 bg-zinc-900/40">
            <AgentNoteSection alert={alert} onGenerate={onGenerateNote} />

            {/* S9-T2: Deviation indicators — beat/miss, implied points */}
            {alert.econData?.beatMiss && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    alert.econData.beatMiss === "beat"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : alert.econData.beatMiss === "miss"
                        ? "bg-red-500/15 text-red-400"
                        : "bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)]"
                  }`}
                >
                  {alert.econData.beatMiss.toUpperCase()}
                </span>
              </div>
            )}

            {/* Footer — fuse shimmer with IV KPI + View in RiskFlow */}
            <div className="flex items-center mt-2.5">
              {alert.ivScore != null ? (
                <div className="relative flex-1 flex items-center h-[18px]">
                  {/* Fuse wire — 2px shimmer, edge to edge */}
                  <div
                    className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] riskflow-fuse-shimmer"
                    style={{
                      background: `linear-gradient(90deg, transparent, ${ivHeatColor(Number(alert.ivScore))}60, transparent)`,
                      backgroundSize: "200% 100%",
                    }}
                  />
                  {/* IV score KPI — sits on the fuse wire */}
                  <span
                    className="relative z-10 text-[9px] font-mono font-bold tabular-nums px-1 bg-zinc-900/90"
                    style={{ color: ivHeatColor(Number(alert.ivScore)) }}
                  >
                    IV {Number(alert.ivScore).toFixed(1)}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 flex-1">
                  {riskType && <RiskTypeBadge riskType={riskType} />}
                  {alert.cyclical && alert.cyclical !== "Neutral" && (
                    <CyclicalBadge classification={alert.cyclical} />
                  )}
                </div>
              )}
              <div className="flex items-center gap-1 ml-2 shrink-0">
                {onNotRelevant && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNotRelevant(alert.id);
                    }}
                    title="Not relevant — remove and flag"
                    className="p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100"
                    style={{
                      transition:
                        "opacity 1.2s ease, color 0.2s ease, background-color 0.2s ease",
                    }}
                  >
                    <ThumbsDown className="w-3 h-3" />
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
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Status Dot ─────────────────────────────────────────────────────────────────

function StatusDot({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className="flex items-center gap-1"
      title={`${label}: ${active ? "connected" : "disconnected"}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${active ? "bg-emerald-400" : "bg-zinc-600"}`}
      />
      <span
        className={`text-[9px] uppercase tracking-wider ${active ? "text-emerald-400/60" : "text-zinc-700"}`}
      >
        {label}
      </span>
    </span>
  );
}

// ── Filter Dropdown ────────────────────────────────────────────────────────────

function FilterDropdown<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="px-1.5 py-0.5 bg-[var(--fintheon-bg)] border border-zinc-800 rounded text-[10px] text-zinc-400 focus:outline-none focus:border-[var(--fintheon-accent)]/40 cursor-pointer"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

// ── Panel ──────────────────────────────────────────────────────────────────────

export default function RiskFlowMini({
  collapsed,
  onToggleCollapsed,
  onChatAlert,
  onNavigateToFeed,
}: {
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  /** Called when user clicks "Chat" CTA on a news alert */
  onChatAlert?: (alert: RiskFlowAlert) => void;
  /** Called when user clicks "View in RiskFlow" in expanded card */
  onNavigateToFeed?: () => void;
}) {
  const {
    alerts,
    highCount,
    mediumCount,
    removeAlert,
    markSeen,
    markAllSeen,
    isSeen,
    refresh,
    refreshing,
    initialLoaded,
    loadMore,
    loadingMore,
    hasMore,
    freshAlertId,
  } = useRiskFlow();
  const backend = useBackend();
  const { addToast } = useToast();
  const {
    severitySet,
    toggleSeverity,
    clearSeverities,
    setSeverityFilter,
    bucketSet,
    toggleBucket,
    clearBuckets,
    showProposals,
    setShowProposals,
    filterAlerts,
  } = useRiskFlowFilters();
  const [expandedInternal, setExpandedInternal] = useState(true);
  const [selectedIdea, setSelectedIdea] = useState<TradeIdeaDetail | null>(
    null,
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [infiniteScroll, setInfiniteScroll] = useState(() => {
    try {
      return localStorage.getItem("fintheon:infinite-scroll") !== "off";
    } catch {
      return true;
    }
  });
  const sourceStatus = useSourceStatus();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const expanded = collapsed != null ? !collapsed : expandedInternal;

  // Persist infinite scroll preference
  useEffect(() => {
    try {
      localStorage.setItem(
        "fintheon:infinite-scroll",
        infiniteScroll ? "on" : "off",
      );
    } catch {}
  }, [infiniteScroll]);

  // Infinite scroll observer — only active when expanded
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !expanded || !infiniteScroll) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore) {
          void loadMore();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [expanded, hasMore, loadingMore, loadMore, infiniteScroll]);

  const handleGenerateNote = useCallback(
    async (alertId: string) => {
      const rawId = alertId.replace(/^backend-/, "");
      try {
        await backend.riskflow.generateNote(rawId);
      } catch (err) {
        console.warn("[RiskFlowMini] Generate note failed:", err);
      }
    },
    [backend],
  );

  /** Extract trade idea page ID from the alert ID (format: ti-{pageId}) */
  const getTradeIdeaPageId = (alertId: string) => alertId.replace("ti-", "");

  const handleApprove = useCallback(
    async (alert: RiskFlowAlert) => {
      const pageId = getTradeIdeaPageId(alert.id);
      const ok = await backend.data.updateTradeIdeaStatus(pageId, "Approved");
      if (ok) removeAlert(alert.id);
    },
    [backend, removeAlert],
  );

  const handleDeny = useCallback(
    async (alert: RiskFlowAlert) => {
      const pageId = getTradeIdeaPageId(alert.id);
      const ok = await backend.data.updateTradeIdeaStatus(pageId, "Denied");
      if (ok) removeAlert(alert.id);
    },
    [backend, removeAlert],
  );

  const handleNotRelevant = useCallback(
    async (id: string) => {
      removeAlert(id);
      addToast("Feedback recorded", "success");
      try {
        const apiBase = (
          import.meta.env.VITE_API_URL || "http://localhost:8080"
        ).replace(/\/$/, "");
        // [claude-code 2026-04-13] Strip backend- prefix so DB lookup matches actual tweet_id
        const rawId = id.replace(/^backend-/, "");
        await fetch(`${apiBase}/api/riskflow/${rawId}/not-relevant`, {
          method: "POST",
        });
      } catch (err) {
        console.warn("[RiskFlowMini] Not-relevant failed:", err);
      }
    },
    [removeAlert, addToast],
  );

  const ideaCount = alerts.filter((a) => a.source === "trade-idea").length;

  const filtered = filterAlerts(alerts);

  const collapsedPreviewItems = alerts.slice(0, 2);

  React.useEffect(() => {
    if (!expanded) return;
    markAllSeen(filtered.map((item) => item.id));
  }, [expanded, filtered, markAllSeen]);

  return (
    <>
      {selectedIdea && (
        <TradeIdeaModal
          idea={selectedIdea}
          onClose={() => setSelectedIdea(null)}
        />
      )}

      <div className="h-full flex flex-col bg-[var(--fintheon-surface)]">
        {/* Header — title + filters + status consolidated */}
        <div className="px-3 py-2 border-b border-[var(--fintheon-accent)]/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-[var(--fintheon-accent)]" />
              <h3 className="text-xs font-semibold tracking-[0.15em] uppercase text-[var(--fintheon-accent)]">
                RiskFlow
              </h3>
              {highCount > 0 && (
                <span className="riskflow-pulse-badge inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500/30 text-red-400 text-[9px] font-bold">
                  {highCount}
                </span>
              )}
              <div className="flex items-center gap-2 ml-1">
                <StatusDot active={sourceStatus.rettiwt} label="X" />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  void refresh();
                }}
                disabled={refreshing}
                className="p-1 rounded hover:bg-[var(--fintheon-accent)]/10 text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors disabled:opacity-40"
                title="Refresh feeds"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
                />
              </button>
              {/* [claude-code 2026-04-19] Trash / clear-all removed — users asked for this
                  to go; dismissal is per-item via the thumbs-down in AlertCardBase. */}
              <button
                onClick={() => {
                  if (onToggleCollapsed) onToggleCollapsed();
                  else setExpandedInternal(!expandedInternal);
                }}
                className="p-1 rounded hover:bg-[var(--fintheon-accent)]/10 text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors"
              >
                {expanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
          {/* Inline filters — same row as header */}
          {expanded && (
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <PriorityFilterMenu
                selected={
                  showProposals ? new Set<AlertSeverity>() : severitySet
                }
                onToggle={(s) => {
                  setShowProposals(false);
                  toggleSeverity(s);
                }}
                onClear={() => {
                  setShowProposals(false);
                  clearSeverities();
                }}
                counts={{
                  high: highCount,
                  medium: mediumCount,
                }}
              />
              <SourceFilterMenu
                selected={showProposals ? new Set() : bucketSet}
                onToggle={(b) => {
                  setShowProposals(false);
                  toggleBucket(b);
                }}
                onClear={() => {
                  setShowProposals(false);
                  clearBuckets();
                }}
              />
              <button
                onClick={() => setShowProposals((v) => !v)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  showProposals
                    ? "bg-[var(--fintheon-accent)]/20 text-[var(--fintheon-accent)]"
                    : "text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/50"
                }`}
              >
                Proposals{ideaCount > 0 ? ` (${ideaCount})` : ""}
              </button>
              <div className="ml-auto flex items-center gap-1">
                <span className="text-[9px] text-zinc-600">
                  Infinite Scroll
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={infiniteScroll}
                  onClick={() => setInfiniteScroll((v) => !v)}
                  className={`relative inline-flex h-3 w-6 items-center rounded-full transition-colors shrink-0 ${
                    infiniteScroll
                      ? "bg-[var(--fintheon-accent)]/30 border border-[var(--fintheon-accent)]/50"
                      : "bg-zinc-800 border border-zinc-700"
                  }`}
                  title={
                    infiniteScroll
                      ? "Infinite scroll ON"
                      : "Infinite scroll OFF"
                  }
                >
                  <span
                    className={`inline-block w-2 h-2 rounded-full transition-transform ${
                      infiniteScroll
                        ? "translate-x-3 bg-[var(--fintheon-accent)]"
                        : "translate-x-0.5 bg-zinc-500"
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
        </div>

        <div
          className={`flex-1 min-h-0 flex flex-col transition-all duration-300 ease-in-out overflow-hidden ${expanded ? "opacity-100" : "max-h-0 opacity-0"}`}
        >
          {/* Alert list */}
          <div className="flex-1 min-w-0 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-zinc-700 text-xs">
                {alerts.length === 0
                  ? initialLoaded
                    ? "Waiting for signals..."
                    : "Loading feed..."
                  : "No matching alerts"}
              </div>
            ) : (
              filtered.map((alert) =>
                alert.source === "trade-idea" && alert.tradeIdea ? (
                  <TradeIdeaRow
                    key={alert.id}
                    alert={alert}
                    onDelete={removeAlert}
                    onOpen={setSelectedIdea}
                    onMarkSeen={markSeen}
                    onApprove={handleApprove}
                    onDeny={handleDeny}
                    seen={isSeen(alert.id)}
                    expanded={expandedId === alert.id}
                    fresh={alert.id === freshAlertId}
                    onToggleExpand={() =>
                      setExpandedId(expandedId === alert.id ? null : alert.id)
                    }
                    onGenerateNote={handleGenerateNote}
                  />
                ) : (
                  <AlertRow
                    key={alert.id}
                    alert={alert}
                    onMarkSeen={markSeen}
                    onChat={onChatAlert}
                    seen={isSeen(alert.id)}
                    expanded={expandedId === alert.id}
                    fresh={alert.id === freshAlertId}
                    onToggleExpand={() =>
                      setExpandedId(expandedId === alert.id ? null : alert.id)
                    }
                    onGenerateNote={handleGenerateNote}
                    onNavigateToFeed={onNavigateToFeed}
                    onNotRelevant={handleNotRelevant}
                  />
                ),
              )
            )}

            {/* Infinite scroll sentinel + load more */}
            {infiniteScroll ? (
              <div ref={sentinelRef} className="h-1" />
            ) : (
              hasMore &&
              filtered.length > 0 && (
                <div className="flex justify-center py-3">
                  <button
                    type="button"
                    onClick={() => {
                      void loadMore();
                    }}
                    disabled={loadingMore}
                    className="text-[10px] text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors px-3 py-1.5 border border-zinc-800 rounded hover:border-[var(--fintheon-accent)]/30 disabled:opacity-40"
                  >
                    {loadingMore ? "Loading..." : "Load More"}
                  </button>
                </div>
              )
            )}

            {loadingMore && (
              <div className="flex items-center justify-center py-3 gap-2">
                <Loader2 className="w-3.5 h-3.5 text-[var(--fintheon-accent)] animate-spin" />
                <span className="text-[9px] text-[var(--fintheon-muted)]/40">
                  Loading more...
                </span>
              </div>
            )}

            {!hasMore && filtered.length > 0 && (
              <div className="text-center py-2">
                <span className="text-[8px] text-[var(--fintheon-muted)]/25">
                  All items loaded
                </span>
              </div>
            )}
          </div>
        </div>

        <div
          className={`transition-all duration-300 ease-in-out overflow-hidden ${!expanded ? "opacity-100" : "max-h-0 opacity-0"}`}
        >
          {!expanded && (
            <div className="px-2 pb-2">
              {collapsedPreviewItems.length === 0 ? (
                <div className="rounded border border-zinc-800/80 bg-[#080806] px-3 py-2 text-[11px] text-zinc-600">
                  No recent items
                </div>
              ) : (
                <div className="bg-[#080806] overflow-hidden">
                  {collapsedPreviewItems.map((item, idx) => {
                    const sev = SEVERITY_CONFIG[item.severity];
                    const seen = isSeen(item.id);
                    return (
                      <a
                        key={item.id}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => markSeen(item.id)}
                        className={`block px-3 py-2 ${idx < collapsedPreviewItems.length - 1 ? "border-b border-zinc-800/80" : ""} ${seen ? "opacity-70" : ""} ${item.id === freshAlertId ? "riskflow-flicker" : ""}`}
                        style={{
                          animation: `fadeInTab 400ms cubic-bezier(0.4, 0, 0.2, 1) ${idx * 60}ms both`,
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <SourceIcon
                            source={item.source}
                            className="w-2.5 h-2.5 text-zinc-500"
                          />
                          <span
                            className={`text-[9px] font-semibold tracking-wider ${sev.text}`}
                          >
                            {sev.label}
                          </span>
                          {item.cyclical && item.cyclical !== "Neutral" && (
                            <CyclicalBadge classification={item.cyclical} />
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-zinc-300 line-clamp-1">
                          {item.headline}
                        </p>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fintheon animation styles */}
        <style>{`
          @keyframes riskflow-pulse {
            0%, 100% { box-shadow: none; }
            50% { box-shadow: inset 0 0 12px rgba(239, 68, 68, 0.08); }
          }
          .riskflow-fintheon-row { animation: riskflow-pulse 3s ease-in-out infinite; }
          @keyframes riskflow-badge-pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.15); opacity: 0.8; }
          }
          .riskflow-pulse-badge { animation: riskflow-badge-pulse 2s ease-in-out infinite; }
        `}</style>
      </div>
    </>
  );
}
