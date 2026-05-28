import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Lock, LockOpen } from "lucide-react";
import { useToast } from "../../contexts/ToastContext";
import { DAY_PLAN_REFETCH_EVENT } from "../../hooks/useDayPlan";
import { useDayPlanMultiWeek } from "../../hooks/useDayPlanWeek";
import { useLockout } from "../../hooks/useLockout";
import { DayCard } from "../narrative/DayCard";
import { KanbanTitle } from "../ui/KanbanTitle";
import { DeskPlanAdvanceButton } from "../executive/DashboardKickstartButtons";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const MULTI_REFETCH_EVENT = "fintheon:day-plan-multi-refetch";

export function DeskPlanWidget() {
  const { addToast } = useToast();
  const { allPlans, currentPlanIndex, goToPlan, isLoading } =
    useDayPlanMultiWeek();
  const { state: lockoutState, lockUntilDeskSession, unlock } = useLockout();
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [selectedQueuedIndex, setSelectedQueuedIndex] = useState(0);
  const deskDateLabel = useMemo(() => formatDeskDate(new Date()), []);
  const queuedWindows = useMemo(
    () =>
      allPlans
        .flatMap((plan, planIndex) =>
          [...(plan.windows ?? [])]
            .sort((a, b) => a.startTime.localeCompare(b.startTime))
            .map((window) => ({
              planIndex,
              planId: plan.id,
              window,
              sortKey: `${plan.date}T${normalizeClock(window.startTime)}`,
            })),
        )
        .sort((a, b) => a.sortKey.localeCompare(b.sortKey)),
    [allPlans],
  );
  const selectedQueuedWindow = queuedWindows[selectedQueuedIndex] ?? null;

  useEffect(() => {
    setSelectedQueuedIndex((current) =>
      queuedWindows.length === 0
        ? 0
        : Math.min(current, queuedWindows.length - 1),
    );
  }, [queuedWindows.length]);

  useEffect(() => {
    if (queuedWindows.length === 0) return;
    const selected = queuedWindows[selectedQueuedIndex];
    if (selected?.planIndex === currentPlanIndex) return;
    const nextIndex = queuedWindows.findIndex(
      (item) => item.planIndex === currentPlanIndex,
    );
    if (nextIndex >= 0) setSelectedQueuedIndex(nextIndex);
  }, [currentPlanIndex, queuedWindows, selectedQueuedIndex]);

  const selectQueuedWindow = useCallback(
    (index: number) => {
      if (queuedWindows.length === 0) return;
      const nextIndex = Math.max(0, Math.min(index, queuedWindows.length - 1));
      setSelectedQueuedIndex(nextIndex);
      goToPlan(queuedWindows[nextIndex]?.planIndex ?? 0);
    },
    [goToPlan, queuedWindows],
  );

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

  const toggleDeskPlanLock = useCallback(async () => {
    if (isLocking) return;
    setIsLocking(true);
    try {
      if (lockoutState.locked) {
        const ok = await unlock();
        addToast(
          ok ? "Terminal unlocked" : "Unlock failed",
          ok ? "success" : "error",
        );
        return;
      }
      const next = await lockUntilDeskSession();
      addToast(
        next.locked ? "Locked until Desk Plan" : "Desk Plan lock failed",
        next.locked ? "success" : "error",
      );
    } finally {
      setIsLocking(false);
    }
  }, [addToast, isLocking, lockUntilDeskSession, lockoutState.locked, unlock]);

  return (
    <section className="flex min-h-0 flex-col overflow-hidden px-2 py-1">
      <KanbanTitle
        title=""
        tone="gold"
        headerRight={
          <div className="ml-auto flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-2">
              <DeskPlanCycler
                currentIndex={selectedQueuedIndex}
                totalPlans={queuedWindows.length}
                onPrev={() => selectQueuedWindow(selectedQueuedIndex - 1)}
                onNext={() => selectQueuedWindow(selectedQueuedIndex + 1)}
                disabled={isLoading}
              />
              <DeskPlanAdvanceButton
                isLoading={isAdvancing}
                onClick={advanceDeskPlan}
              />
              <DeskPlanLockButton
                isLocked={lockoutState.locked}
                isLoading={isLocking}
                onClick={toggleDeskPlanLock}
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
          preferredWindowId={selectedQueuedWindow?.window.id ?? null}
          className="flex h-full flex-col"
        />
      </div>
    </section>
  );
}

function DeskPlanLockButton({
  isLocked,
  isLoading,
  onClick,
}: {
  isLocked: boolean;
  isLoading: boolean;
  onClick: () => void;
}) {
  const Icon = isLocked ? Lock : LockOpen;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className="p-1 rounded text-zinc-500 transition-colors hover:bg-[var(--fintheon-accent)]/10 hover:text-[var(--fintheon-accent)] disabled:opacity-40"
      title={isLocked ? "Unlock terminal" : "Lock until next Desk Plan"}
      aria-label={isLocked ? "Unlock terminal" : "Lock until next Desk Plan"}
    >
      <Icon
        className={`h-3.5 w-3.5 ${isLoading ? "animate-pulse" : ""}`}
        strokeWidth={2}
      />
    </button>
  );
}

function normalizeClock(value: string): string {
  const [hourRaw = "00", minuteRaw = "00"] = value.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return "00:00";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
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
        className="rounded px-0.5 text-[var(--fintheon-accent)]/65 transition-colors hover:text-[var(--fintheon-accent)] disabled:cursor-default disabled:text-[var(--fintheon-muted)]/24"
        aria-label="Previous desk plan"
      >
        &lt;
      </button>
      <span className="tabular-nums text-[var(--fintheon-accent)]/72">
        {displayIndex} of {totalPlans}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={disabled || currentIndex >= totalPlans - 1}
        className="rounded px-0.5 text-[var(--fintheon-accent)]/65 transition-colors hover:text-[var(--fintheon-accent)] disabled:cursor-default disabled:text-[var(--fintheon-muted)]/24"
        aria-label="Next desk plan"
      >
        &gt;
      </button>
      <span>]</span>
    </span>
  );
}
