// [claude-code 2026-04-30] Mini catalyst cards use the canonical RiskFlow anatomy.
import { useMemo } from "react";
import type { CatalystCard } from "../../lib/narrative-types";
import {
  severityScale,
  severityOpacity,
  CARD_ENTER_CLASS,
  SEVERITY_PULSE_CLASS,
  staggerDelay,
} from "../../lib/narrative-motion";
import { RiskFlowCardAnatomy } from "../feed/RiskFlowCardAnatomy";
import {
  catalystDirection,
  catalystFuseScore,
  catalystIvScore,
  catalystSeverityToFuse,
  catalystSourceLabel,
} from "../../lib/catalyst-riskflow-utils";

interface NarrativeMiniCardProps {
  card: CatalystCard;
  isSelected: boolean;
  isImported: boolean;
  onClick: () => void;
  onDrillDown?: () => void;
  staggerIndex?: number;
}

import { timeAgo } from "../../lib/time-utils";

export default function NarrativeMiniCard({
  card,
  isSelected,
  isImported,
  onClick,
  staggerIndex = 0,
}: NarrativeMiniCardProps) {
  const scale = severityScale(card.severity);
  const opacity = severityOpacity(card.severity);
  const pulseClass = card.severity === "high" ? SEVERITY_PULSE_CLASS : "";
  const fuseScore = useMemo(() => catalystFuseScore(card), [card]);

  return (
    <div
      className={`cursor-pointer select-none transition-transform duration-150 ${CARD_ENTER_CLASS} ${pulseClass}`}
      style={{
        width: "160px",
        transform: `scale(${scale})`,
        opacity,
        ...staggerDelay(staggerIndex),
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform =
          `scale(${scale}) translateY(-1px)`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = `scale(${scale})`;
      }}
    >
      <RiskFlowCardAnatomy
        title={card.title}
        sourceLabel={isImported ? "RiskFlow" : catalystSourceLabel(card)}
        timestampLabel={timeAgo(card.date)}
        severity={catalystSeverityToFuse(card.severity)}
        fuseScore={fuseScore}
        ivScore={catalystIvScore(card)}
        direction={catalystDirection(card)}
        compact
        selected={isSelected}
      />
    </div>
  );
}
