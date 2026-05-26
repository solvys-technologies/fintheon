import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useDayPlanMultiWeek } from "../../hooks/useDayPlanWeek";
import { FadingRuler } from "../shared/FadingRuler";
import {
  buildUpcomingDeskPlanFeed,
  type DeskPlanFeedItem,
} from "../desk/desk-plan-feed-utils";

export function BulletinDeskPlanTab() {
  const { allPlans, isLoading, error } = useDayPlanMultiWeek();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const items = useMemo(() => buildUpcomingDeskPlanFeed(allPlans), [allPlans]);

  if (isLoading) {
    return (
      <div className="flex min-h-[140px] items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-[var(--fintheon-accent)]/45" />
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <p className="text-[11px] text-[var(--fintheon-bearish)]/70">
        Desk unavailable.
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-[11px] text-[var(--fintheon-muted)]/58">
        No upcoming desk plan.
      </p>
    );
  }

  return (
    <div className="animate-in fade-in duration-150">
      {items.slice(0, 4).map((item, index) => (
        <div key={item.id}>
          {index > 0 ? <FadingRuler className="my-2 opacity-45" /> : null}
          <DeskPlanMiniRow
            item={item}
            expanded={expandedId === item.id}
            onToggle={() =>
              setExpandedId((current) => (current === item.id ? null : item.id))
            }
          />
        </div>
      ))}
    </div>
  );
}

function DeskPlanMiniRow({
  item,
  expanded,
  onToggle,
}: {
  item: DeskPlanFeedItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full text-left transition-colors hover:text-[var(--fintheon-accent)]"
    >
      <div className="flex items-start gap-2">
        {expanded ? (
          <ChevronDown className="mt-1 h-3 w-3 shrink-0 text-[var(--fintheon-accent)]" />
        ) : (
          <ChevronRight className="mt-1 h-3 w-3 shrink-0 text-[var(--fintheon-muted)]/55" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 font-mono text-[8.5px] uppercase tracking-[0.1em] text-[var(--fintheon-accent)]/58">
            <span>{item.dateLabel}</span>
            <span className="h-1 w-px bg-[var(--fintheon-accent)]/18" />
            <span>{item.timeRange}</span>
          </div>
          <p className="mt-1 line-clamp-2 text-[12px] font-semibold leading-snug text-[var(--fintheon-text)]/88">
            {item.title}
          </p>
          {expanded ? (
            <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--fintheon-text)]/58">
              {item.prediction}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 rounded-sm border border-[var(--fintheon-accent)]/12 px-1.5 py-0.5 font-mono text-[8px] text-[var(--fintheon-accent)]/70">
          {item.country}
        </span>
      </div>
    </button>
  );
}
