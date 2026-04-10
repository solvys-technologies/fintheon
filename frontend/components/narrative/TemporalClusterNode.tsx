// [claude-code 2026-03-28] S9-T5-T3: Temporal cluster node for hierarchical zoom (0.2–0.4)
import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { TemporalCluster } from "../../lib/narrative-hierarchy";

const THREAD_COLORS: Record<string, string> = {
  "middle-east-conflict": "#F59E0B",
  "liquidity-credit-contraction": "#8B5CF6",
  "ai-singularity": "#3B82F6",
  "usd-jpy-carry-trade": "#EC4899",
  "trade-war": "#EF4444",
  "us-china-relations": "#14B8A6",
  "rate-cut-cycle": "#34D399",
  "trump-presidency": "#F97316",
  "price-stability": "#FBBF24",
  "maximum-employment": "#A78BFA",
};

interface TemporalClusterNodeData extends TemporalCluster {
  settled: boolean;
}

export const TemporalClusterNode = memo(
  ({ data }: { data: TemporalClusterNodeData }) => {
    const threadColor = THREAD_COLORS[data.narrativeSlug] ?? "#6B7280";
    const severityColor =
      data.maxSeverity === "high"
        ? "#EF4444"
        : data.maxSeverity === "medium"
          ? "#c79f4a"
          : "var(--fintheon-text-muted)";

    return (
      <div
        className="rounded-lg px-3 py-2 border transition-opacity duration-300"
        style={{
          width: 220,
          backgroundColor: "var(--fintheon-surface)",
          borderColor: `${threadColor}30`,
          borderLeftColor: threadColor,
          borderLeftWidth: 3,
          opacity: data.settled ? 1 : 0,
        }}
      >
        <Handle
          type="target"
          position={Position.Top}
          className="!bg-transparent !border-0 !w-0 !h-0"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-transparent !border-0 !w-0 !h-0"
        />

        <div
          className="text-[10px] font-mono text-[var(--fintheon-text)] truncate"
          title={data.label}
        >
          <span
            className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
            style={{ backgroundColor: threadColor }}
          />
          {data.label}
        </div>

        <div className="flex gap-0.5 mt-1">
          {data.cards.slice(0, 12).map((card, i) => (
            <span
              key={i}
              className="text-[8px]"
              style={{
                color: card.sentiment === "bullish" ? "#34D399" : "#EF4444",
              }}
            >
              {card.sentiment === "bullish" ? "▲" : "▼"}
            </span>
          ))}
          {data.cards.length > 12 && (
            <span className="text-[8px] text-[var(--fintheon-text-muted)]">
              +{data.cards.length - 12}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-1 text-[9px] font-mono text-[var(--fintheon-text-muted)]">
          <span style={{ color: severityColor }}>
            {data.maxSeverity.toUpperCase()}
          </span>
          <span>{data.cards.length} events</span>
        </div>
      </div>
    );
  },
);
TemporalClusterNode.displayName = "TemporalClusterNode";
