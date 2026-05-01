// [claude-code 2026-04-25] S38: Generate Note CTA now produces a structured detailed
//   note — original headline link + ≤200-char summary + bullish/bearish/neutral read
//   conditioned on the user's selected instrument (localStorage `fintheon:selected-instrument`,
//   default /ES). Renders link + summary + direction badge in the expanded card.
// [claude-code 2026-04-10] S9-T2: Refactored to use AlertCardBase — detail variant
// [claude-code 2026-04-30] Expanded state now delegates to RiskFlowPostCard:
//   Twitter-inspired post anatomy, full-card preview toggle, and one Ask AI CTA.
import { useState } from "react";
import type { RiskFlowAlert } from "../../lib/riskflow-feed";
import { AlertCardBase } from "./AlertCardBase";
import { RiskFlowPostCard } from "./RiskFlowPostCard";

export type RiskFlowDetailSurface = "full" | "timeline" | "mini";

interface RiskFlowDetailCardProps {
  alert: RiskFlowAlert;
  seen?: boolean;
  onGenerateNote?: (itemId: string) => void;
  onNotRelevant?: (id: string, reason?: string) => void;
  onAskAI?: (alert: RiskFlowAlert) => void;
  /** Which surface this card is rendering in. Drives SourcePreview visibility. */
  surface?: RiskFlowDetailSurface;
}

export function RiskFlowDetailCard({
  alert,
  seen,
  onNotRelevant,
  onAskAI,
  surface = "mini",
}: RiskFlowDetailCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <AlertCardBase
      alert={alert}
      variant="detail"
      seen={seen}
      expanded={expanded}
      onToggle={() => setExpanded(!expanded)}
      onNotRelevant={onNotRelevant}
      className={`${
        expanded
          ? "border-b border-[var(--fintheon-accent)]/30"
          : "border-b border-zinc-800/60 hover:border-[var(--fintheon-accent)]/30"
      } ${seen ? "opacity-70" : ""}`}
      style={
        expanded
          ? ({
              "--tw-ring-color":
                "color-mix(in srgb, var(--fintheon-accent) 20%, transparent)",
            } as React.CSSProperties)
          : undefined
      }
      expandedContent={
        <RiskFlowPostCard alert={alert} surface={surface} onAskAI={onAskAI} onNotRelevant={onNotRelevant} />
      }
    />
  );
}
