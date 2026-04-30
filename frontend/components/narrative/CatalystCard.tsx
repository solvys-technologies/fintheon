// [claude-code 2026-04-30] Catalyst cards now use the canonical RiskFlow card
// anatomy: preview headline, left IV fuse, right IV/direction stack.
// [claude-code 2026-03-16] Stone theme + narrative theme integration
// [claude-code 2026-03-16] Added tag pills and inline tag-add button
// [claude-code 2026-04-19] url:… tags surface as paperclip chip; raw URL no longer leaks into UI
import { useState, useCallback } from "react";
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

interface CatalystCardProps {
  catalyst: CatalystCardType;
  compact?: boolean;
  selected?: boolean;
  onSelect: (id: string) => void;
  onTagAdd?: (id: string, tag: string) => void;
  onDragStart?: (e: React.DragEvent, id: string) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  cardRef?: (el: HTMLDivElement | null) => void;
}

export default function CatalystCard({
  catalyst,
  compact = false,
  selected = false,
  onSelect,
  onDragStart,
  onDragEnd,
  cardRef,
}: CatalystCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = useCallback(() => {
    onSelect(catalyst.id);
  }, [onSelect, catalyst.id]);

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      onDragStart?.(e, catalyst.id);
    },
    [onDragStart, catalyst.id],
  );

  const fuseScore = catalystFuseScore(catalyst);

  const borderColor = selected
    ? "var(--fintheon-accent)"
    : `color-mix(in srgb, var(--fintheon-border) ${isHovered ? "50%" : "30%"}, transparent)`;

  return (
    <div
      ref={cardRef}
      draggable={!!onDragStart}
      onClick={handleClick}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={[
        "cursor-pointer select-none transition-colors duration-200",
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
    </div>
  );
}
