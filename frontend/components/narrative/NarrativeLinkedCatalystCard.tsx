import type { CSSProperties } from "react";
import NarrativeResearchCard from "./NarrativeResearchCard";
import type { SensemakingCatalyst } from "./sensemaking-types";
import { toNarrativeCatalystCard } from "./sensemaking-catalyst-adapter";

interface NarrativeLinkedCatalystCardProps {
  catalyst: SensemakingCatalyst;
  nodeId?: string | null;
  selected?: boolean;
  compact?: boolean;
  staggerIndex?: number;
  className?: string;
  onSelectNode?: (nodeId: string) => void;
}

export function NarrativeLinkedCatalystCard({
  catalyst,
  nodeId,
  selected = false,
  compact = false,
  staggerIndex = 0,
  className = "",
  onSelectNode,
}: NarrativeLinkedCatalystCardProps) {
  const card = toNarrativeCatalystCard(catalyst);
  const style = {
    "--narrative-fade-delay": `${staggerIndex * 45}ms`,
  } as CSSProperties;

  function selectLinkedNode() {
    if (!nodeId) return;
    onSelectNode?.(nodeId);
  }

  return (
    <div
      className={`narrative-linked-catalyst-card narrative-fade-item ${className}`}
      style={style}
    >
      <NarrativeResearchCard
        catalyst={card}
        compact={compact}
        selected={selected}
        onSelect={() => selectLinkedNode()}
        onExpand={nodeId ? () => selectLinkedNode() : undefined}
      />
    </div>
  );
}
