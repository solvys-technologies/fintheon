// [claude-code 2026-04-10] S9-T2: Shared card anatomy for RiskFlow detail + tape variants
import { ChevronDown, ChevronUp } from "lucide-react";
import type { RiskFlowAlert } from "../../lib/riskflow-feed";
import { inferDirection } from "../../lib/riskflow-feed";
import { SEVERITY_CONFIG } from "../../lib/severity-config";
import { ivHeatColor } from "../../types/miroshark";
import { SourceIcon } from "../../lib/shared-icons";
import { timeAgo } from "../../lib/time-utils";

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
  className,
  style,
}: AlertCardBaseProps) {
  const sev = SEVERITY_CONFIG[alert.severity];
  const isHigh = alert.severity === "high" || alert.severity === "critical";
  const dir = inferDirection(alert);
  const isBull = dir === "Bullish";

  return (
    <div
      className={`group relative overflow-hidden transition-colors ${
        isHigh ? "riskflow-fintheon-row" : ""
      } ${sev.label === "CRIT" ? "riskflow-severe-shimmer" : ""} ${
        expanded ? "riskflow-expand-pulse" : ""
      } ${className || ""}`}
      style={style}
    >
      {/* ── Collapsed: headline + source icon top-right ─────────────────────── */}
      <div
        className="block px-3 pt-2.5 pb-2 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-start gap-2">
          {headerActions}
          <div className="flex-1 min-w-0">
            <p
              className={`text-xs leading-snug font-medium line-clamp-3 break-words ${
                alert.severity === "critical"
                  ? "text-orange-300"
                  : isHigh
                    ? "text-red-300"
                    : "text-zinc-300"
              } group-hover:text-white transition-colors`}
            >
              {alert.headline}
            </p>
            {alert.summary && alert.summary !== alert.headline && (
              <p className="text-[10px] text-zinc-600 line-clamp-1 mt-0.5">
                {alert.summary}
              </p>
            )}
          </div>

          {/* Source icon — top right */}
          <SourceIcon
            source={alert.source}
            className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0 mt-0.5"
          />
        </div>
      </div>

      {/* ── Footer bar: time / direction / points / priority / risk-type / chevron ── */}
      <div
        className="flex items-center px-3 py-1.5 bg-zinc-900/80 border-t border-zinc-800/40 cursor-pointer"
        onClick={onToggle}
      >
        <span className="text-[10px] text-zinc-600">
          {timeAgo(alert.publishedAt)}
        </span>

        <span className="flex-1" />

        {/* Direction chevron + IV Score — right-aligned */}
        <span
          className="text-[11px] font-bold"
          style={{
            color: isBull
              ? "var(--fintheon-bullish)"
              : "var(--fintheon-bearish)",
          }}
        >
          {isBull ? "▲" : "▼"}
        </span>
        {alert.ivScore != null && (
          <span
            className="ml-1.5 text-[11px] font-mono font-bold tabular-nums"
            style={{ color: ivHeatColor(Number(alert.ivScore)) }}
          >
            IV {Number(alert.ivScore).toFixed(1)}
          </span>
        )}

        {/* Priority badge */}
        <span
          className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider ${sev.bg} ${sev.text} ${sev.border} border`}
        >
          {sev.label}
        </span>

        {/* Risk type tag */}
        {alert.riskType && (
          <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 text-[9px] font-medium tracking-wider uppercase border border-zinc-700 text-zinc-400">
            {alert.riskType}
          </span>
        )}

        {/* Expand chevron */}
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
