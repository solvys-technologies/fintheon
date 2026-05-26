import { useCallback, useState } from "react";
import { BookOpen } from "lucide-react";
import { useToast } from "../../contexts/ToastContext";
import { DAY_PLAN_REFETCH_EVENT } from "../../hooks/useDayPlan";
import { DayCard } from "../narrative/DayCard";
import { KanbanTitle } from "../ui/KanbanTitle";
import { DeskPlanAdvanceButton } from "../executive/DashboardKickstartButtons";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const MULTI_REFETCH_EVENT = "fintheon:day-plan-multi-refetch";

export function DeskPlanWidget() {
  const { addToast } = useToast();
  const [isAdvancing, setIsAdvancing] = useState(false);

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
          <div className="ml-auto flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--fintheon-accent)]/62">
              <BookOpen className="h-3 w-3" />
              Desk Plan
            </span>
            <DeskPlanAdvanceButton
              isLoading={isAdvancing}
              onClick={advanceDeskPlan}
            />
          </div>
        }
      />
      <div className="relative mt-2 min-h-0 flex-1 overflow-y-auto pr-1">
        <DayCard bare />
      </div>
    </section>
  );
}
