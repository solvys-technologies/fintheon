// [claude-code 2026-05-16] S68-T5: Hover lift, gold border, click-to-expand detail modal
import { useState, useCallback, useEffect, useRef } from "react";
import type { CatalystCard as CatalystCardType } from "../../lib/narrative-types";
import { RiskFlowCardAnatomy } from "../feed/RiskFlowCardAnatomy";
import { timeAgo } from "../../lib/time-utils";
import {
  catalystDirection,
  catalystFuseScore,
  catalystIvScore,
  catalystSeverityToFuse,
  catalystSourceLabel,
} from "../../lib/catalyst-riskflow-utils";
import { formatMarketImpact } from "../../lib/market-impact-format";
import DriftBubble from "./DriftBubble";
import type { DriftBubbleData } from "./DriftBubble";

interface CatalystCardProps {
  catalyst: CatalystCardType;
  compact?: boolean;
  selected?: boolean;
  onSelect: (id: string) => void;
  onTagAdd?: (id: string, tag: string) => void;
  onDragStart?: (e: React.DragEvent, id: string) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  cardRef?: (el: HTMLDivElement | null) => void;
  drift?: DriftBubbleData;
}

function CatalystDetailModal({
  catalyst,
  onClose,
}: {
  catalyst: CatalystCardType;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const impactText = formatMarketImpact(catalyst.marketImpact);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#050402]/60" />
      <div ref={ref} className="fintheon-modal-surface relative max-w-lg w-full">
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h3 className="text-sm font-semibold text-[var(--fintheon-text)] leading-snug">
              {catalyst.title}
            </h3>
            <button
              onClick={onClose}
              className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-[var(--fintheon-muted)]/50 hover:text-[var(--fintheon-text)] hover:bg-[var(--fintheon-accent)]/10 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {catalyst.description && (
            <p className="text-[12px] text-[var(--fintheon-text)]/70 leading-relaxed mb-3">
              {catalyst.description}
            </p>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[10px]">
            <span className="text-[var(--fintheon-muted)]/50">Source:</span>
            <span className="text-[var(--fintheon-text)]/80">{catalystSourceLabel(catalyst)}</span>

            <span className="text-[var(--fintheon-muted)]/50">Date:</span>
            <span className="text-[var(--fintheon-text)]/80">{timeAgo(catalyst.date)}</span>

            {catalyst.directionBias && (
              <>
                <span className="text-[var(--fintheon-muted)]/50">Bias:</span>
                <span className="text-[var(--fintheon-text)]/80 capitalize">{catalyst.directionBias}</span>
              </>
            )}

            {catalyst.narrative && (
              <>
                <span className="text-[var(--fintheon-muted)]/50">Thread:</span>
                <span className="text-[var(--fintheon-text)]/80">{catalyst.narrative}</span>
              </>
            )}
          </div>

          {catalyst.tags && catalyst.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {catalyst.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: "rgba(199,159,74,0.1)",
                    color: "var(--fintheon-accent)",
                    border: "1px solid rgba(199,159,74,0.15)",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {impactText && (
            <div className="mt-3 pt-3 border-t border-[var(--fintheon-accent)]/10">
              <span className="text-[9px] uppercase tracking-wider text-[var(--fintheon-muted)]/40 mb-1.5 block">
                Market Impact
              </span>
              <div className="text-[10px] leading-4 text-[var(--fintheon-text)]/60">
                {impactText}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CatalystCard({
  catalyst,
  compact = false,
  selected = false,
  onSelect,
  onDragStart,
  onDragEnd,
  cardRef,
  drift,
}: CatalystCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const handleClick = useCallback(() => {
    onSelect(catalyst.id);
    setDetailOpen(true);
  }, [onSelect, catalyst.id]);

  const handleCloseDetail = useCallback(() => {
    setDetailOpen(false);
  }, []);

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      onDragStart?.(e, catalyst.id);
    },
    [onDragStart, catalyst.id],
  );

  const fuseScore = catalystFuseScore(catalyst);

  const borderColor = selected
    ? "var(--fintheon-accent)"
    : isHovered
      ? "var(--fintheon-accent)"
      : `color-mix(in srgb, var(--fintheon-border) 30%, transparent)`;

  return (
    <>
      <div
        ref={cardRef}
        draggable={!!onDragStart}
        onClick={handleClick}
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={[
          "relative cursor-pointer select-none",
          compact ? "w-[120px]" : "w-[160px]",
          selected ? "catalyst-card-pulse" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          backgroundColor: "rgba(10,9,5,0.68)",
          border: `1px solid ${borderColor}`,
          minHeight: compact ? "auto" : "80px",
          transform: isHovered ? "translateY(-2px)" : "translateY(0)",
          transition: "transform 0.15s ease, border-color 0.15s ease",
        }}
      >
        <RiskFlowCardAnatomy
          title={catalyst.title}
          sourceLabel={catalystSourceLabel(catalyst)}
          timestampLabel={timeAgo(catalyst.date)}
          severity={catalystSeverityToFuse(catalyst.severity)}
          fuseScore={fuseScore}
          ivScore={catalystIvScore(catalyst)}
          direction={catalystDirection(catalyst)}
          compact={compact}
          selected={selected}
        />
        {drift && (
          <div className="absolute top-1 right-1">
            <DriftBubble drift={drift} size="sm" />
          </div>
        )}
      </div>
      {detailOpen && <CatalystDetailModal catalyst={catalyst} onClose={handleCloseDetail} />}
    </>
  );
}
