// [claude-code 2026-03-28] S9-T5-T3: Category cluster node for hierarchical zoom (< 0.1)
import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type {
  CategoryGroup,
  MarketRegime,
} from "../../lib/narrative-hierarchy";
import { CATEGORY_COLORS } from "../../lib/narrative-force-layout";

const CATEGORY_LABELS: Record<string, string> = {
  geopolitical: "GEOPOLITICAL",
  monetary: "MONETARY POLICY",
  macroeconomic: "MACROECONOMIC",
  "market-structure": "MARKET STRUCTURE",
  earnings: "EARNINGS",
  "supply-chain": "SUPPLY CHAIN",
  "black-swan": "BLACK SWAN",
};

const REGIME_STYLES: Record<
  MarketRegime,
  { bg: string; text: string; label: string }
> = {
  "risk-on": { bg: "#34D39920", text: "#34D399", label: "RISK-ON ▲" },
  "risk-off": { bg: "#EF444420", text: "#EF4444", label: "RISK-OFF ▼" },
  rotation: { bg: "#F59E0B20", text: "#F59E0B", label: "ROTATION ↔" },
  neutral: { bg: "#6B728020", text: "#6B7280", label: "NEUTRAL —" },
};

interface CategoryClusterNodeData extends CategoryGroup {
  settled: boolean;
}

export const CategoryClusterNode = memo(
  ({ data }: { data: CategoryClusterNodeData }) => {
    const catColor = CATEGORY_COLORS[data.category] ?? "#6B7280";
    const regime = REGIME_STYLES[data.regime];

    return (
      <div
        className="rounded-xl px-5 py-4 border text-center transition-opacity duration-500"
        style={{
          width: 280,
          backgroundColor: `${catColor}14`,
          borderColor: `${catColor}4D`,
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
          className="text-sm font-mono tracking-widest"
          style={{ color: catColor }}
        >
          {CATEGORY_LABELS[data.category] ?? data.category.toUpperCase()}
        </div>

        <div
          className="inline-block mt-2 px-3 py-1 rounded-full text-[10px] font-mono tracking-wider"
          style={{ backgroundColor: regime.bg, color: regime.text }}
        >
          {regime.label}
        </div>

        <div className="mt-2 text-[10px] font-mono text-[var(--fintheon-text-muted)]">
          {data.threads.length} threads · {data.cardCount} events
        </div>
      </div>
    );
  },
);
CategoryClusterNode.displayName = "CategoryClusterNode";
