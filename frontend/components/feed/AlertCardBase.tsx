// [claude-code 2026-04-12] S9-T2: Shared card anatomy for RiskFlow detail + tape variants
// [claude-code 2026-04-12] Added linkifyText — URLs in headlines/summaries are now clickable
// [claude-code 2026-04-30] Source-only RiskFlow cards remove the faint
// dismiss/thumb control from the shared preview anatomy.
// [claude-code 2026-04-19] RiskFlow card polish — adopt mobile anatomy: single segmented
//   left vertical fuse (NothingFuse with ruler ticks + shimmer), right column with direction
//   chevron stacked above IV number in Doto. Removed the bottom hero footer's IV+chevron
//   pair; the footer now carries time, priority, risk type and dismiss controls only.
// [claude-code 2026-04-30] Canonical RiskFlow anatomy now owns preview/full-headline
// reveal so expanded bodies do not duplicate source, IV, or headline metadata.
import type { RiskFlowAlert } from "../../lib/riskflow-feed";
import { inferDirection } from "../../lib/riskflow-feed";
import { timeAgo } from "../../lib/time-utils";
import { bucketOfAlert } from "../../lib/source-buckets";
import {
  alertSeverityToPalette,
  fuseScoreFromAlert,
} from "../../lib/riskflow-card-utils";
import { RiskFlowCardAnatomy } from "./RiskFlowCardAnatomy";

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
  /** Legacy callback retained for call-site compatibility; no visible dismiss control. */
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
  className,
  style,
}: AlertCardBaseProps) {
  const dir = inferDirection(alert);
  const isBull = dir === "Bullish";

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

  const handlePreviewKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <div className={`relative ${className || ""}`} style={style}>
      <div
        className="block cursor-pointer focus:outline-none focus-visible:bg-[var(--fintheon-accent)]/5"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`${expanded ? "Collapse" : "Expand"} RiskFlow item: ${alert.headline}`}
        onClick={onToggle}
        onKeyDown={handlePreviewKeyDown}
      >
        <RiskFlowCardAnatomy
          title={alert.headline}
          sourceLabel={bucketOfAlert(alert)}
          timestampLabel={timeAgo(alert.publishedAt)}
          severity={palSeverity}
          fuseScore={fuseScore}
          ivScore={alert.ivScore != null ? Number(alert.ivScore) : null}
          direction={directionForStack}
          expanded={expanded}
        >
          {headerActions}
        </RiskFlowCardAnatomy>
      </div>

      {/* ── Expanded content: smooth grid-template-rows transition ────────── */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">{expandedContent}</div>
      </div>
    </div>
  );
}
