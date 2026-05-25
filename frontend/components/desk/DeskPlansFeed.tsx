import { useMemo } from "react";
import { AlertTriangle, BookOpen, Loader2 } from "lucide-react";
import { useDayPlanMultiWeek } from "../../hooks/useDayPlanWeek";
import { FadingRuler } from "../shared/FadingRuler";
import { NothingFuse } from "../shared/NothingFuse";
import {
  buildUpcomingDeskPlanFeed,
  type DeskPlanFeedItem,
} from "./desk-plan-feed-utils";

export function DeskPlansFeed() {
  const { allPlans, isLoading, error } = useDayPlanMultiWeek();
  const items = useMemo(
    () => buildUpcomingDeskPlanFeed(allPlans),
    [allPlans],
  );

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-[var(--fintheon-accent)]/45" />
      </div>
    );
  }

  if (error && items.length === 0) {
    return <DeskPlanEmptyState tone="error" text="Desk plans unavailable" />;
  }

  if (items.length === 0) {
    return <DeskPlanEmptyState text="No upcoming desk plans" />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-end justify-between gap-3 px-4 pb-2 pt-3">
        <div>
          <p className="font-mono text-[9px] text-[var(--fintheon-accent)]/72">
            Upcoming
          </p>
          <h2 className="mt-1 text-[12px] font-semibold text-[var(--fintheon-text)]/85">
            Desk Plans
          </h2>
        </div>
        <span className="font-mono text-[9px] text-[var(--fintheon-muted)]/42">
          {items.length}
        </span>
      </div>
      <FadingRuler className="mx-4 opacity-45" />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <DeskPlanFeedCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}

function DeskPlanFeedCard({ item }: { item: DeskPlanFeedItem }) {
  const tone = getTone(item);
  return (
    <article className="group relative overflow-hidden rounded-md border border-[var(--fintheon-accent)]/16 bg-[var(--fintheon-surface)]/72 p-3 transition-[border-color,background-color,transform] duration-300 hover:-translate-y-0.5 hover:border-[var(--fintheon-accent)]/34 hover:bg-[var(--fintheon-accent)]/[0.055]">
      <span
        aria-hidden="true"
        className="absolute inset-y-3 left-0 w-[2px] rounded-r"
        style={{ backgroundColor: tone.color }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] text-[var(--fintheon-accent)]/68">
              {item.dateLabel}
            </span>
            <span className="h-1 w-1 rounded-full bg-[var(--fintheon-accent)]/30" />
            <span className="font-mono text-[9px] text-[var(--fintheon-muted)]/48">
              {item.timeRange}
            </span>
          </div>
          <h3 className="mt-2 line-clamp-2 text-[13px] font-semibold leading-snug text-[var(--fintheon-text)]/92">
            {item.title}
          </h3>
        </div>
        <div className="shrink-0 rounded border border-[var(--fintheon-accent)]/15 bg-black/20 px-1.5 py-1 text-right">
          <p className="font-mono text-[9px] text-[var(--fintheon-accent)]/74">
            {item.country}
          </p>
          <p className="mt-0.5 font-mono text-[8px] text-[var(--fintheon-muted)]/38">
            {tone.label}
          </p>
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-[10.5px] leading-relaxed text-[var(--fintheon-text)]/62">
        {item.prediction}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <NothingFuse
            value={(item.probability ?? 42) / 100}
            color={tone.color}
            thickness={3}
            segments={6}
            animateIn
          />
        </div>
        <span className="font-mono text-[9px] text-[var(--fintheon-muted)]/50">
          {item.probability != null ? `${item.probability}%` : "PEND"}
        </span>
      </div>
      <p className="mt-2 line-clamp-1 font-mono text-[9px] text-[var(--fintheon-muted)]/36">
        {item.forecast}
      </p>
    </article>
  );
}

function DeskPlanEmptyState({
  text,
  tone = "empty",
}: {
  text: string;
  tone?: "empty" | "error";
}) {
  const Icon = tone === "error" ? AlertTriangle : BookOpen;
  return (
    <div className="flex h-full items-center justify-center px-5 text-center">
      <div className="rounded-md border border-[var(--fintheon-accent)]/14 bg-[var(--fintheon-surface)]/45 px-5 py-6">
        <Icon className="mx-auto h-5 w-5 text-[var(--fintheon-accent)]/45" />
        <p className="mt-3 text-[11px] text-[var(--fintheon-text)]/48">
          {text}
        </p>
      </div>
    </div>
  );
}

function getTone(item: DeskPlanFeedItem) {
  if (item.direction === "bullish") {
    return { color: "var(--fintheon-bullish)", label: "Bull" };
  }
  if (item.direction === "bearish") {
    return { color: "var(--fintheon-bearish)", label: "Bear" };
  }
  return { color: "var(--fintheon-accent)", label: "Desk" };
}
