import { Diff, TrendingDown, Minus } from "lucide-react";
import { FeedItem as FeedItemType } from "../../types/feed";
import { decodeHtmlEntities } from "../../lib/html-entities";
import { ProposalCard } from "./ProposalCard";

interface FeedItemProps {
  item: FeedItemType;
}

export function FeedItem({ item }: FeedItemProps) {
  // [claude-code 2026-03-23] Browser Use Phase 2 — render proposal cards
  if (item.type === "proposal" && item.proposal) {
    return <ProposalCard proposal={item.proposal} timestamp={item.time} />;
  }

  // Safety check: ensure iv exists and value is a number
  const ivValue =
    item?.iv?.value != null
      ? typeof item.iv.value === "number"
        ? item.iv.value
        : Number(item.iv.value) || 0
      : 0;
  const ivType = item?.iv?.type || "Neutral";
  const ivClassification = item?.iv?.classification || "Neutral";

  const ivColor = {
    Bullish: "text-emerald-400",
    Bearish: "text-red-500",
    Neutral: "text-gray-400",
  };

  const IVIcon = {
    Bullish: Diff,
    Bearish: TrendingDown,
    Neutral: Minus,
  };

  const Icon = IVIcon[ivType];

  const displayText = decodeHtmlEntities(item.text);

  return (
    <div className="bg-[var(--fintheon-surface)] border border-[var(--fintheon-border)]/10 rounded p-3 hover:bg-[var(--fintheon-surface)]/80 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-500">
              {item.time.toLocaleTimeString()}
            </span>
            <span className="text-xs text-[var(--fintheon-accent)]">
              {item.source}
            </span>
            {item.type === "alert" && (
              <span className="text-xs text-red-400">ALERT</span>
            )}
          </div>
          <p className="text-sm text-gray-200">{displayText}</p>
        </div>

        <div className="flex flex-col items-end gap-1 min-w-[80px]">
          <div className={`flex items-center gap-1 ${ivColor[ivType]}`}>
            <Icon className="w-3 h-3" />
            <span className="text-xs font-semibold">
              IV {ivValue > 0 ? "+" : ""}
              {ivValue.toFixed(1)}
            </span>
          </div>
          <span className="text-xs text-gray-500">{ivClassification}</span>
        </div>
      </div>
    </div>
  );
}
