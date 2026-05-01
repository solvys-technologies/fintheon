// [claude-code 2026-04-30] Research catalysts now share canonical RiskFlow card
// anatomy and no longer render a separate detailed passage by default.
// [claude-code 2026-04-25] S35: image hero + source-handoff link added under research bullets
//   so promoted RiskFlow catalysts carry their original article preview into Sanctum.
// [claude-code 2026-03-27] ChatMind-style research card — bullets, metadata, drill-deeper, highlight support
import { useState, useCallback, useRef } from "react";
import type { CatalystCard } from "../../lib/narrative-types";
import { CatalystImage, SourceHandoffLink } from "../shared/CatalystImage";
import { RiskFlowCardAnatomy } from "../feed/RiskFlowCardAnatomy";
import { timeAgo } from "../../lib/time-utils";
import {
  catalystDirection,
  catalystFuseScore,
  catalystIvScore,
  catalystSeverityToFuse,
  catalystSourceLabel,
} from "../../lib/catalyst-riskflow-utils";

interface NarrativeResearchCardProps {
  catalyst: CatalystCard;
  compact?: boolean;
  selected?: boolean;
  highlightMode?: boolean;
  onSelect: (id: string) => void;
  onExpand?: (id: string) => void;
  onHighlightBranch?: (cardId: string, highlightedText: string) => void;
  onDrillDeeper?: (cardId: string, query: string) => void;
  cardRef?: (el: HTMLDivElement | null) => void;
}

export default function NarrativeResearchCard({
  catalyst,
  compact = false,
  selected = false,
  highlightMode = false,
  onSelect,
  onExpand,
  onHighlightBranch,
  cardRef,
}: NarrativeResearchCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const cardDomRef = useRef<HTMLDivElement | null>(null);

  const handleClick = useCallback(() => {
    if (!highlightMode) onSelect(catalyst.id);
  }, [highlightMode, onSelect, catalyst.id]);

  const handleExpand = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onExpand?.(catalyst.id);
    },
    [onExpand, catalyst.id],
  );

  // Highlight text selection handler
  const handleMouseUp = useCallback(() => {
    if (!highlightMode || !onHighlightBranch) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const text = sel.toString().trim();
    if (
      !text ||
      !cardDomRef.current?.contains(sel.getRangeAt(0).commonAncestorContainer)
    )
      return;
    onHighlightBranch(catalyst.id, text);
    setTimeout(() => sel.removeAllRanges(), 300);
  }, [highlightMode, onHighlightBranch, catalyst.id]);

  const width = compact ? 200 : 280;
  const isGhost = catalyst.isGhost;
  const isAgent = catalyst.source === "agent";
  const borderColor = selected
    ? "var(--fintheon-accent)"
    : `color-mix(in srgb, var(--fintheon-border) ${isHovered ? "50%" : "30%"}, transparent)`;
  const fuseScore = catalystFuseScore(catalyst);

  return (
    <div
      ref={(el) => {
        cardDomRef.current = el;
        cardRef?.(el);
      }}
      onClick={handleClick}
      onMouseUp={handleMouseUp}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={[
        "rounded-[8px] transition-colors duration-200",
        highlightMode ? "cursor-text" : "cursor-pointer",
        selected ? "research-card-selected" : "",
        isAgent ? "research-card-agent" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        width: `${width}px`,
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        backgroundColor: "rgba(10,9,5,0.68)",
        border: `1px solid ${borderColor}`,
        opacity: isGhost ? 0.7 : 1,
        borderStyle: isGhost ? "dashed" : undefined,
        userSelect: highlightMode ? "text" : "none",
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
        expanded={selected}
        compact={compact}
        selected={selected}
      >
        {onExpand && (
          <button
            onClick={handleExpand}
            title="Expand card"
            className="absolute right-2 top-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] text-[var(--fintheon-text)]/30 transition-colors hover:bg-[var(--fintheon-accent)]/8 hover:text-[var(--fintheon-text)]/60"
          >
            ↗
          </button>
        )}
      </RiskFlowCardAnatomy>

      {/* [claude-code 2026-04-25] S35: hero image + source link rail */}
      {catalyst.imageUrl && (
        <div className="px-3 pb-2">
          <CatalystImage
            imageUrl={catalyst.imageUrl}
            href={catalyst.sourceUrl}
            maxHeight={compact ? 96 : 140}
          />
        </div>
      )}

      {/* [claude-code 2026-04-25] S35: source handoff under bullets */}
      {catalyst.sourceUrl && (
        <div className="px-3 pb-1">
          <SourceHandoffLink url={catalyst.sourceUrl} />
        </div>
      )}
    </div>
  );
}
