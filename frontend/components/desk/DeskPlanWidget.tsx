import { useCallback, useMemo, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "../../contexts/ToastContext";
import { DAY_PLAN_REFETCH_EVENT } from "../../hooks/useDayPlan";
import { useDayPlanMultiWeek } from "../../hooks/useDayPlanWeek";
import { DayCard } from "../narrative/DayCard";
import { KanbanTitle } from "../ui/KanbanTitle";
import { DeskPlanAdvanceButton } from "../executive/DashboardKickstartButtons";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const MULTI_REFETCH_EVENT = "fintheon:day-plan-multi-refetch";

export function DeskPlanWidget() {
  const { addToast } = useToast();
  const { currentPlanIndex, totalPlans, goNext, goPrev, isLoading } =
    useDayPlanMultiWeek();
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [windowControlsTarget, setWindowControlsTarget] =
    useState<HTMLSpanElement | null>(null);
  const deskDateLabel = useMemo(() => formatDeskDate(new Date()), []);

  const advanceDeskPlan = useCallback(async () => {
    if (isAdvancing) return;
    setIsAdvancing(true);
    try {
      const apiBase = API_BASE.replace(/\/$/, "");
      const response = await fetch(`${apiBase}/api/day-plan/kickstart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 7 }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json().catch(() => null)) as {
        failures?: unknown[];
      } | null;
      if (payload?.failures?.length)
        throw new Error(`${payload.failures.length} day-plan failures`);
      window.dispatchEvent(new Event(DAY_PLAN_REFETCH_EVENT));
      window.dispatchEvent(new Event(MULTI_REFETCH_EVENT));
      addToast("Desk plan advanced", "success");
    } catch (error) {
      console.warn("[Desk] Desk plan kickstart failed:", error);
      addToast("Desk plan advance failed", "error");
    } finally {
      setIsAdvancing(false);
    }
  }, [addToast, isAdvancing]);

  return (
    <section className="flex min-h-0 flex-col overflow-hidden px-2 py-1">
      <KanbanTitle
        title=""
        tone="gold"
        headerRight={
          <div className="ml-auto flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-2">
              <span
                ref={setWindowControlsTarget}
                className="inline-flex min-w-[46px] justify-end"
              />
              <DeskPlanCycler
                currentIndex={currentPlanIndex}
                totalPlans={totalPlans}
                onPrev={goPrev}
                onNext={goNext}
                disabled={isLoading}
              />
              <DeskPlanAdvanceButton
                isLoading={isAdvancing}
                onClick={advanceDeskPlan}
              />
              <span className="inline-flex items-center gap-1.5 font-mono text-[12px] uppercase tracking-[0.17em] text-[var(--fintheon-accent)]/72">
                Desk Plan
                <BookOpen className="h-4 w-4" />
              </span>
            </div>
            <span className="font-mono text-[10.5px] text-[var(--fintheon-muted)]/52">
              {deskDateLabel}
            </span>
          </div>
        }
      />
      <div className="relative mt-2 min-h-0 flex-1 overflow-y-auto pr-1">
        <DayCard
          bare
          hideHeader
          fillThesis
          windowControlsPortal={windowControlsTarget}
          className="flex h-full flex-col"
        />
      </div>
    </section>
  );
}

function formatDeskDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function DeskPlanCycler({
  currentIndex,
  totalPlans,
  onPrev,
  onNext,
  disabled,
}: {
  currentIndex: number;
  totalPlans: number;
  onPrev: () => void;
  onNext: () => void;
  disabled: boolean;
}) {
  if (totalPlans <= 0) {
    return (
      <span className="inline-flex min-w-[78px] justify-center font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]/32">
        [&lt; -- &gt;]
      </span>
    );
  }

  const displayIndex = Math.min(currentIndex + 1, totalPlans);
  return (
    <span className="inline-flex min-w-[96px] items-center justify-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]/64">
      <span>[</span>
      <button
        type="button"
        onClick={onPrev}
        disabled={disabled || currentIndex <= 0}
        className="rounded p-0.5 text-[var(--fintheon-accent)]/65 transition-colors hover:text-[var(--fintheon-accent)] disabled:cursor-default disabled:text-[var(--fintheon-muted)]/24"
        aria-label="Previous desk plan"
      >
        <ChevronLeft className="h-3 w-3" />
      </button>
      <span className="tabular-nums text-[var(--fintheon-accent)]/72">
        {displayIndex} of {totalPlans}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={disabled || currentIndex >= totalPlans - 1}
        className="rounded p-0.5 text-[var(--fintheon-accent)]/65 transition-colors hover:text-[var(--fintheon-accent)] disabled:cursor-default disabled:text-[var(--fintheon-muted)]/24"
        aria-label="Next desk plan"
      >
        <ChevronRight className="h-3 w-3" />
      </button>
      <span>]</span>
    </span>
  );
}
