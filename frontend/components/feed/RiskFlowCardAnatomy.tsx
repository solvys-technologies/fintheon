// [claude-code 2026-04-30] Canonical RiskFlow card anatomy shared across feed,
// Strategium, NarrativeFlow catalysts, and timeline surfaces.
import { useEffect, useState } from "react";
import type { FuseSeverity } from "../../lib/fuse-palette";
import { colorForSeverity } from "../../lib/fuse-palette";
import { NothingFuse } from "../shared/NothingFuse";
import { IVStack, type IVStackDirection } from "../shared/IVStack";

export interface RiskFlowCardAnatomyProps {
  title: string;
  sourceLabel?: string | null;
  timestampLabel?: string | null;
  severity: FuseSeverity;
  fuseScore: number;
  ivScore?: number | null;
  direction?: IVStackDirection;
  expanded?: boolean;
  compact?: boolean;
  selected?: boolean;
  fresh?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function RiskFlowCardAnatomy({
  title,
  sourceLabel,
  timestampLabel,
  severity,
  fuseScore,
  ivScore,
  direction = "Neutral",
  expanded = false,
  compact = false,
  selected = false,
  fresh = false,
  className = "",
  children,
}: RiskFlowCardAnatomyProps) {
  const [headlineRevealed, setHeadlineRevealed] = useState(!expanded);
  const severityColor = colorForSeverity(severity);
  const verticalFuseValue = expanded
    ? 0
    : Math.min(1, Math.max(0.15, fuseScore / 10));

  useEffect(() => {
    if (!expanded) {
      setHeadlineRevealed(false);
      return;
    }
    const raf = requestAnimationFrame(() => setHeadlineRevealed(true));
    return () => cancelAnimationFrame(raf);
  }, [expanded, title]);

  return (
    <div
      className={`group relative overflow-hidden border-b border-[var(--fintheon-accent)]/10 bg-[rgba(10,9,5,0.68)] transition-colors hover:border-[var(--fintheon-accent)]/22 ${
        selected ? "border-[var(--fintheon-accent)]/35" : ""
      } ${fresh ? "riskflow-flicker" : ""} ${className}`}
    >
      <div
        className={`flex items-stretch gap-3 ${compact ? "px-2 py-2 min-h-[58px]" : "px-3 py-2.5 min-h-[64px]"}`}
      >
        <div className="flex w-[6px] shrink-0 items-stretch py-0.5">
          <NothingFuse
            value={verticalFuseValue}
            severity={severity}
            orientation="vertical"
            thickness={6}
            animateIn={fresh}
          />
        </div>

        <div className="min-w-0 flex-1 self-center">
          <p
            className={`t-text-reveal font-medium leading-snug text-[var(--fintheon-text)] ${
              compact ? "text-[11px]" : "text-xs"
            } ${expanded ? "line-clamp-none" : "line-clamp-3"}`}
            data-open={
              expanded ? (headlineRevealed ? "true" : "false") : "true"
            }
            style={{ textWrap: expanded ? "pretty" : "balance" }}
          >
            {title}
          </p>
          {(sourceLabel || timestampLabel) && (
            <div className="mt-1 flex items-center gap-1.5 text-[9px] uppercase tracking-[0.08em] text-[var(--fintheon-text)]/35">
              {sourceLabel && <span className="truncate">{sourceLabel}</span>}
              {sourceLabel && timestampLabel && (
                <span className="text-[var(--fintheon-text)]/20">&middot;</span>
              )}
              {timestampLabel && (
                <span className="shrink-0 tabular-nums">{timestampLabel}</span>
              )}
            </div>
          )}
        </div>

        <IVStack
          score={ivScore}
          direction={direction}
          color={severityColor}
          width={compact ? 32 : 36}
          fontSize={compact ? 11 : 13}
          chevronSize={compact ? 12 : 14}
        />
      </div>

      {children}
    </div>
  );
}
