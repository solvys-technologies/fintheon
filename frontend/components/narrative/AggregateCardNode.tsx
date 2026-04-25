// [claude-code 2026-04-24] S36 ClusterBeam — click now opens the right-docked ClusterBeamPanel
// instead of inline-expanding. Inline expansion block removed (~140 lines). Added DensityMeter
// sparkline in the collapsed header. Fuse-shimmer strip untouched (feedback_fuses_are_sacred).
import { memo, useCallback, useMemo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { ivHeatColor } from "../../types/agent-desk";
import {
  SEVERITY_COLORS,
  deriveIvScore,
  formatDateShort,
} from "../../lib/narrative-territory-layout";
import type { CatalystCard } from "../../lib/narrative-types";
import { useClusterBeam } from "../../contexts/ClusterBeamContext";
import { DensityMeter } from "./DensityMeter";

export interface AggregateCardNodeData {
  label: string;
  cards: CatalystCard[];
  narrativeColor: string;
  narrativeSlug?: string;
  narrativeTitle?: string;
  groupId: string;
  siblingIndex?: number;
  siblingCount?: number;
}

export const AggregateCardNode = memo(function AggregateCardNode({
  id,
  data,
}: NodeProps & { data: AggregateCardNodeData }) {
  const {
    label,
    cards,
    narrativeColor,
    narrativeSlug,
    narrativeTitle,
    groupId,
    siblingIndex,
    siblingCount,
  } = data;

  const { active, toggle } = useClusterBeam();

  const sortedCards = useMemo(
    () => [...cards].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")),
    [cards],
  );

  const dateRange =
    sortedCards.length > 0
      ? `${formatDateShort(sortedCards[0].date)} — ${formatDateShort(sortedCards[sortedCards.length - 1].date)}`
      : "";

  const maxSeverity: "high" | "medium" | "low" = cards.some(
    (card) => card.severity === "high",
  )
    ? "high"
    : cards.some((card) => card.severity === "medium")
      ? "medium"
      : "low";

  const severityColor = SEVERITY_COLORS[maxSeverity];

  const avgIv = useMemo(() => {
    if (cards.length === 0) return 0;
    const total = cards.reduce((sum, card) => sum + deriveIvScore(card), 0);
    return total / cards.length;
  }, [cards]);

  const isActive = active?.groupId === groupId;

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      toggle({
        groupId,
        clusterNodeId: id,
        narrativeSlug,
        narrativeTitle,
        narrativeColor,
        label,
        cards,
      });
    },
    [
      toggle,
      groupId,
      id,
      narrativeSlug,
      narrativeTitle,
      narrativeColor,
      label,
      cards,
    ],
  );

  return (
    <div
      onClick={handleClick}
      data-cluster-node="true"
      data-group-id={groupId}
      style={{
        minWidth: 260,
        maxWidth: 300,
        borderRadius: 8,
        border: `1.5px solid ${isActive ? `${narrativeColor}aa` : `${severityColor}30`}`,
        background: "color-mix(in srgb, #0a0a00 92%, transparent)",
        overflow: "hidden",
        cursor: "pointer",
        transition: "all 0.25s ease",
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ opacity: 0, width: 1, height: 1 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, width: 1, height: 1 }}
      />

      <div
        style={{
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 3,
            height: 36,
            borderRadius: 2,
            overflow: "hidden",
            flexShrink: 0,
            background: `linear-gradient(to top, ${narrativeColor}20, ${narrativeColor}, ${narrativeColor}20)`,
            backgroundSize: "100% 200%",
            animation: "fuse-shimmer 2s ease-in-out infinite",
          }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--fintheon-text)",
              fontFamily: "var(--font-heading)",
              lineHeight: "1.3",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginTop: 4,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: narrativeColor,
                fontFamily: "var(--font-mono)",
              }}
            >
              {cards.length} items
            </span>
            <span
              style={{
                fontSize: 10,
                color: "var(--fintheon-muted)",
                fontFamily: "var(--font-mono)",
                opacity: 0.6,
              }}
            >
              {dateRange}
            </span>
            {siblingCount != null && siblingCount > 1 && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: narrativeColor,
                  fontFamily: "var(--font-mono)",
                  background: `${narrativeColor}12`,
                  padding: "1px 5px",
                  borderRadius: 3,
                  opacity: 0.8,
                }}
              >
                {(siblingIndex ?? 0) + 1}/{siblingCount}
              </span>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: ivHeatColor(avgIv),
              fontFamily: "var(--font-mono)",
              lineHeight: 1,
            }}
          >
            {avgIv.toFixed(1)}
          </span>
          <span
            style={{
              fontSize: 7,
              color: "var(--fintheon-muted)",
              fontFamily: "var(--font-mono)",
              opacity: 0.5,
              marginTop: 1,
            }}
          >
            IV
          </span>
          <DensityMeter cards={cards} accentColor={narrativeColor} />
        </div>

        <span
          style={{
            fontSize: 10,
            color: "var(--fintheon-muted)",
            opacity: isActive ? 0.9 : 0.4,
            transition: "opacity 0.2s",
          }}
        >
          ▸
        </span>
      </div>
    </div>
  );
});
