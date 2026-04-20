// [claude-code 2026-04-12] S9-T2: Shared card anatomy for RiskFlow detail + tape variants
// [claude-code 2026-04-12] Added linkifyText — URLs in headlines/summaries are now clickable
// [claude-code 2026-04-15] S16-T5: Dismissal reason quick-select popover on thumbs-down
// [claude-code 2026-04-19] RiskFlow card polish — adopt mobile anatomy: single segmented
//   left vertical fuse (NothingFuse with ruler ticks + shimmer), right column with direction
//   chevron stacked above IV number in Doto. Removed the bottom hero footer's IV+chevron
//   pair; the footer now carries time, priority, risk type and dismiss controls only.
import { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  ThumbsDown,
} from "@/components/shared/iso-icons";
import type { RiskFlowAlert } from "../../lib/riskflow-feed";
import { inferDirection } from "../../lib/riskflow-feed";
import { SEVERITY_CONFIG } from "../../lib/severity-config";
import { ivHeatColor } from "../../types/agent-desk";
import { SourceIcon } from "../../lib/shared-icons";
import { timeAgo } from "../../lib/time-utils";
import { linkifyText } from "../../lib/linkify";
import { bucketOfAlert } from "../../lib/source-buckets";
import { NothingFuse } from "../shared/NothingFuse";
import { IVStack } from "../shared/IVStack";
import {
  alertSeverityToPalette,
  fuseScoreFromAlert,
} from "../../lib/riskflow-card-utils";

const DISMISS_REASONS = [
  { value: "redundant", label: "Redundant" },
  { value: "irrelevant-topic", label: "Irrelevant Topic" },
  { value: "stale", label: "Stale / Outdated" },
  { value: "spam", label: "Spam / Noise" },
  { value: "other", label: "Other" },
] as const;

interface AlertCardBaseProps {
  alert: RiskFlowAlert;
  variant: "detail" | "tape";
  seen?: boolean;
  expanded: boolean;
  onToggle: () => void;
  /** Render expanded content (agent notes, econ data, tags, etc.) */
  expandedContent?: React.ReactNode;
  /** Optional action buttons for the collapsed header row */
  headerActions?: React.ReactNode;
  /** Thumbs-down callback — marks item as not relevant, with optional reason */
  onNotRelevant?: (id: string, reason?: string) => void;
  /** Override outer container className (variant-specific borders, bg, opacity) */
  className?: string;
  /** Override outer container style */
  style?: React.CSSProperties;
}

export function AlertCardBase({
  alert,
  expanded,
  onToggle,
  expandedContent,
  headerActions,
  onNotRelevant,
  className,
  style,
}: AlertCardBaseProps) {
  const sev = SEVERITY_CONFIG[alert.severity];
  const isHigh = alert.severity === "high" || alert.severity === "critical";
  const dir = inferDirection(alert);
  const isBull = dir === "Bullish";
  const [showReasonPicker, setShowReasonPicker] = useState(false);
  const reasonRef = useRef<HTMLDivElement>(null);

  // Close reason picker on outside click
  useEffect(() => {
    if (!showReasonPicker) return;
    const handler = (e: MouseEvent) => {
      if (reasonRef.current && !reasonRef.current.contains(e.target as Node)) {
        setShowReasonPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showReasonPicker]);

  const palSeverity = alertSeverityToPalette(alert.severity);
  const fuseScore = fuseScoreFromAlert(alert);
  const directionForStack: "Bullish" | "Bearish" | "Neutral" =
    dir === "Bullish"
      ? "Bullish"
      : isBull
        ? "Bullish"
        : dir
          ? "Bearish"
          : "Neutral";

  return (
    <div
      className={`group relative overflow-hidden transition-colors ${
        isHigh ? "riskflow-fintheon-row" : ""
      } ${sev.label === "CRIT" ? "riskflow-severe-shimmer" : ""} ${
        expanded ? "riskflow-expand-pulse" : ""
      } ${className || ""}`}
      style={style}
    >
      {/* ── Collapsed: left fuse | source/headline | right IV stack ──────────── */}
      <div className="block cursor-pointer" onClick={onToggle}>
        <div className="flex items-stretch gap-3 px-3 py-2.5 min-h-[64px]">
          {/* Left: segmented vertical fuse with shimmer */}
          <div className="flex-shrink-0 w-[6px] flex items-stretch py-0.5">
            <NothingFuse
              value={Math.min(1, Math.max(0.15, fuseScore / 10))}
              severity={palSeverity}
              orientation="vertical"
              thickness={6}
              animateIn
            />
          </div>

          {headerActions}

          {/* Center: source/time row + headline + summary */}
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
            <div className="flex items-center gap-1.5 text-[9px] tracking-[0.08em] uppercase text-zinc-500">
              <SourceIcon
                source={alert.source}
                className="w-2.5 h-2.5 text-zinc-500 flex-shrink-0"
              />
              <span className="truncate max-w-[60%]">
                {bucketOfAlert(alert)}
              </span>
              <span className="text-zinc-700">&middot;</span>
              <span>{timeAgo(alert.publishedAt)}</span>
            </div>
            <p
              className={`text-xs leading-snug font-medium line-clamp-3 break-words ${
                alert.severity === "critical"
                  ? "text-orange-300"
                  : isHigh
                    ? "text-red-300"
                    : "text-zinc-300"
              } group-hover:text-white transition-colors`}
            >
              {linkifyText(alert.headline)}
            </p>
            {alert.summary && alert.summary !== alert.headline && (
              <p className="text-[10px] text-zinc-600 line-clamp-1 mt-0.5">
                {linkifyText(alert.summary)}
              </p>
            )}
          </div>

          {/* Right: chevron + IV in Doto, right-justified */}
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
        </div>
      </div>

      {/* ── Footer bar: time-strip is gone; keep priority + dismiss controls ── */}
      <div
        className="flex items-center px-3 py-1 bg-zinc-900/60 border-t border-zinc-800/40 cursor-pointer"
        onClick={onToggle}
      >
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded-[2px] text-[9px] font-bold tracking-wider ${sev.bg} ${sev.text} ${sev.border} border`}
        >
          {sev.label}
        </span>

        {alert.riskType && (
          <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 text-[9px] font-medium tracking-wider uppercase border border-zinc-700 text-zinc-400">
            {alert.riskType}
          </span>
        )}

        <span className="flex-1" />

        {onNotRelevant && (
          <div className="relative" ref={reasonRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowReasonPicker((v) => !v);
              }}
              className="inline-flex p-0.5 rounded text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100"
              style={{ transition: "opacity 1.2s ease, color 0.2s ease" }}
              title="Not relevant"
            >
              <ThumbsDown className="w-2.5 h-2.5" />
            </button>
            {showReasonPicker && (
              <div
                className="absolute right-0 bottom-full mb-1 z-50 min-w-[140px] py-1 bg-zinc-900 border border-zinc-700 rounded shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                {DISMISS_REASONS.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => {
                      setShowReasonPicker(false);
                      onNotRelevant(alert.id, r.value);
                    }}
                    className="block w-full text-left px-3 py-1.5 text-[10px] text-zinc-300 hover:bg-[var(--fintheon-accent)]/10 hover:text-[var(--fintheon-accent)] transition-colors"
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <span className="ml-2 text-zinc-600">
          {expanded ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </span>
      </div>

      {/* ── Expanded content: smooth grid-template-rows transition ────────── */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          {expandedContent}

          {/* Fuse shimmer bar — severity-colored along expanded card footer */}
          {alert.ivScore != null && (
            <div
              className="h-[2px] w-full riskflow-fuse-shimmer"
              style={{
                background: `linear-gradient(90deg, transparent, ${ivHeatColor(Number(alert.ivScore))}60, transparent)`,
                backgroundSize: "200% 100%",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
